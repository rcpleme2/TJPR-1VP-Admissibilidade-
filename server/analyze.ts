import { verificarPrazos } from '../shared/prazos';
import { verificarResultado } from '../shared/precedentes';
import {
  LIMITES,
  ModelOutputSchema,
  modelOutputJsonSchema,
  type AdmissibilityAnalysisResult,
  type AnalyzeRequest,
  type ModelOutput,
} from '../shared/schema';
import { MODELOS_PADRAO } from './config';
import { SYSTEM_PROMPT } from './prompt';
import { PROVEDORES_IMPL } from './providers';
import { ProviderError, type ParteEntrada } from './providers/types';
import { sanitizeUntrustedInput } from './sanitize';

export class RequisicaoInvalida extends Error {}

export function bytesDeBase64(b64: string): number {
  const limpo = b64.replace(/\s/g, '');
  const pad = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - pad;
}

/** Valida arquivos além do schema: assinatura %PDF, tamanho total, conteúdo presente. */
export function validarArquivos(files: AnalyzeRequest['files']): number {
  let total = 0;
  for (const f of files) {
    if (f.mimeType === 'application/pdf') {
      if (!f.dataBase64) throw new RequisicaoInvalida(`O arquivo "${f.name}" não possui conteúdo.`);
      if (!/^[A-Za-z0-9+/=\s]+$/.test(f.dataBase64)) throw new RequisicaoInvalida(`O arquivo "${f.name}" não está em base64 válido.`);
      const cabecalho = Buffer.from(f.dataBase64.slice(0, 16), 'base64').toString('latin1');
      if (!cabecalho.startsWith('%PDF-')) throw new RequisicaoInvalida(`O arquivo "${f.name}" não é um PDF válido.`);
      total += bytesDeBase64(f.dataBase64);
    } else if (!f.textPreview) {
      throw new RequisicaoInvalida(`O arquivo "${f.name}" não possui texto.`);
    }
  }
  if (total > LIMITES.maxBytesTotal) {
    throw new RequisicaoInvalida(
      `Os PDFs somam ${(total / 1048576).toFixed(1)} MB; o limite é ${(LIMITES.maxBytesTotal / 1048576).toFixed(0)} MB por análise (limite de requisição do Cloud Run).`,
    );
  }
  return total;
}

const ROTULO_PAPEL: Record<string, string> = {
  acordao: 'acórdão recorrido',
  acordao_embargos: 'acórdão dos embargos de declaração',
  recurso_especial: 'recurso especial',
  recurso_extraordinario: 'recurso extraordinário',
  outro: 'outra peça',
};

export function montarPartes(req: AnalyzeRequest): { partes: ParteEntrada[]; avisos: string[] } {
  const avisos: string[] = [];
  const { sanitized: notas, warnings } = sanitizeUntrustedInput(req.notes ?? '');
  avisos.push(...warnings);

  const partes: ParteEntrada[] = [];
  let intro = 'Analise os autos e peças recursais anexadas para o Juízo de Admissibilidade da 1ª Vice-Presidência do TJPR.\n';
  intro += `Tipo recursal pretendido: ${{ auto: 'Análise conjunta (REsp e/ou RE)', resp: 'Recurso Especial', re: 'Recurso Extraordinário', ambos: 'REsp e RE concomitantes' }[req.appealType]}\n`;
  if (notas) intro += `<UNTRUSTED_USER_NOTES>\n${notas}\n</UNTRUSTED_USER_NOTES>\n`;
  intro += '\nDocumentos processuais submetidos a análise:\n';
  partes.push({ kind: 'text', text: intro });

  for (const f of req.files) {
    const nome = f.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    partes.push({ kind: 'text', text: `<UNTRUSTED_DOCUMENT_CONTENT filename="${nome}" role="${ROTULO_PAPEL[f.role]}">` });
    if (f.mimeType === 'application/pdf' && f.dataBase64) {
      partes.push({ kind: 'pdf', name: nome.endsWith('.pdf') ? nome : `${nome}.pdf`, base64: f.dataBase64.replace(/\s/g, '') });
    } else if (f.textPreview) {
      const { sanitized, warnings: w } = sanitizeUntrustedInput(f.textPreview);
      avisos.push(...w);
      partes.push({ kind: 'text', text: sanitized });
    }
    partes.push({ kind: 'text', text: '</UNTRUSTED_DOCUMENT_CONTENT>' });
  }
  return { partes, avisos: [...new Set(avisos)] };
}

function semNulos(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(semNulos);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, semNulos(x)]));
  }
  return v;
}

export function interpretarSaida(texto: string): { ok: true; data: ModelOutput } | { ok: false; erro: string } {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let json: unknown;
  try {
    json = JSON.parse(limpo);
  } catch {
    return { ok: false, erro: 'A resposta do modelo não é um JSON válido.' };
  }
  const r = ModelOutputSchema.safeParse(semNulos(json));
  if (!r.success) {
    const resumo = r.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join('; ');
    return { ok: false, erro: `A resposta do modelo não segue o formato esperado (${resumo}).` };
  }
  return { ok: true, data: r.data };
}

/** Acrescenta cálculos determinísticos e a verificação automática de precedentes. */
export function enriquecer(out: ModelOutput, meta: AdmissibilityAnalysisResult['meta']): AdmissibilityAnalysisResult {
  return { ...out, verificacoes: verificarPrazos(out), precedentes: verificarResultado(out), meta };
}

export interface ResultadoAnalise {
  data: AdmissibilityAnalysisResult;
  avisosSeguranca: string[];
}

export async function executarAnalise(
  req: AnalyzeRequest,
  apiKey: string,
  etapa: (mensagem: string) => void,
  signal?: AbortSignal,
): Promise<ResultadoAnalise> {
  etapa('Validando e sanitizando os documentos…');
  validarArquivos(req.files);
  const { partes, avisos } = montarPartes(req);

  const model = req.model || MODELOS_PADRAO[req.provider];
  const impl = PROVEDORES_IMPL[req.provider];
  const jsonSchema = modelOutputJsonSchema();

  let tentativaPartes = partes;
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    etapa(tentativa === 1 ? `Consultando o motor ${req.provider.toUpperCase()} (${model})…` : 'Corrigindo resposta fora do formato…');
    const texto = await impl.executar({ apiKey, model, system: SYSTEM_PROMPT, partes: tentativaPartes, jsonSchema, signal });
    etapa('Validando a estrutura da resposta…');
    const r = interpretarSaida(texto);
    if (r.ok) {
      etapa('Recalculando prazos e verificando precedentes…');
      const data = enriquecer(r.data, { provedor: req.provider, modelo: model, geradoEm: new Date().toISOString() });
      return { data, avisosSeguranca: avisos };
    }
    ultimoErro = r.erro;
    tentativaPartes = [...partes, { kind: 'text', text: `\nA resposta anterior foi rejeitada: ${r.erro} Responda novamente seguindo estritamente o schema.` }];
  }
  throw new ProviderError(`${ultimoErro} Tente novamente ou troque o motor.`, 502, false);
}
