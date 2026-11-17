import { verificarPrazos } from '../shared/prazos';
import { verificarResultado } from '../shared/precedentes';
import { sobrestamentoInicial, type OpcoesBaseStj } from '../shared/sobrestamento';
import { buscarTemas, prepararConsulta, temaPorNumero, temasCitados, type IndiceTemas, type TemaEncontrado, type TemaStj } from '../shared/temasStj';
import { baseStj } from './temasStj';
import { preparoInicial } from '../shared/preparo';
import {
  LIMITES,
  ModelOutputSchema,
  modelOutputJsonSchema,
  EntradasPrazoSchema,
  type AdmissibilityAnalysisResult,
  type AnalyzeRequest,
  type EntradasPrazo,
  type ModelOutput,
} from '../shared/schema';
import { MODELO_FIXO } from './config';
import { resolverModelo } from './modelosNivel';
import { ROTULO_NIVEL } from '../shared/modelos';
import { montarPromptSistema } from './prompt';
import { PROVEDORES_IMPL } from './providers';
import { ProviderError, type ParteEntrada } from './providers/types';
import { sanitizeUntrustedInput } from './sanitize';
import type { AlertaInjecao } from '../shared/injecao';

export class RequisicaoInvalida extends Error {}

export function bytesDeBase64(b64: string): number {
  const limpo = b64.replace(/\s/g, '');
  const pad = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - pad;
}

/** Valida arquivos além do schema: assinatura %PDF, tamanho total, conteúdo presente. */
export function validarArquivos(files: AnalyzeRequest['files']): number {
  let total = 0;
  let chars = 0;
  for (const f of files) {
    if (f.mimeType === 'application/pdf') {
      if (!f.dataBase64) throw new RequisicaoInvalida(`O arquivo "${f.name}" não possui conteúdo.`);
      if (!/^[A-Za-z0-9+/=\s]+$/.test(f.dataBase64)) throw new RequisicaoInvalida(`O arquivo "${f.name}" não está em base64 válido.`);
      const cabecalho = Buffer.from(f.dataBase64.slice(0, 16), 'base64').toString('latin1');
      if (!cabecalho.startsWith('%PDF-')) throw new RequisicaoInvalida(`O arquivo "${f.name}" não é um PDF válido.`);
      total += bytesDeBase64(f.dataBase64);
    } else if (!f.textPreview) {
      throw new RequisicaoInvalida(`O arquivo "${f.name}" não possui texto.`);
    } else {
      chars += f.textPreview.length;
    }
  }
  if (chars > LIMITES.maxTextoTotal) {
    throw new RequisicaoInvalida(`O texto enviado soma ${(chars / 1000).toFixed(0)} mil caracteres; o limite é ${(LIMITES.maxTextoTotal / 1000).toFixed(0)} mil por análise.`);
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
  guia_preparo: 'guia ou comprovante de preparo (custas e porte)',
  outro: 'outro documento dos autos',
};

export function montarPartes(req: AnalyzeRequest): { partes: ParteEntrada[]; avisos: AlertaInjecao[] } {
  const avisos: AlertaInjecao[] = [];
  const { sanitized: notas, alertas } = sanitizeUntrustedInput(req.notes ?? '', 'Observações');
  avisos.push(...alertas);

  const partes: ParteEntrada[] = [];
  let intro = 'Analise os autos e peças recursais anexadas para o Juízo de Admissibilidade da 1ª Vice-Presidência do TJPR.\n';
  intro += `Tipo recursal pretendido: ${{ auto: 'Análise conjunta (REsp e/ou RE)', resp: 'Recurso Especial', re: 'Recurso Extraordinário', ambos: 'REsp e RE concomitantes' }[req.appealType]}\n`;
  const prazo = req.prazo;
  if (prazo?.dataIntimacaoAcordao || prazo?.dataIntimacaoEmbargos) {
    intro += 'Datas de intimação informadas pelo usuário (use-as como referência; não as recalcule):\n';
    if (prazo.dataIntimacaoAcordao) intro += `- Intimação/publicação do acórdão: ${prazo.dataIntimacaoAcordao}\n`;
    if (prazo.dataIntimacaoEmbargos) intro += `- Intimação/publicação do acórdão dos embargos de declaração: ${prazo.dataIntimacaoEmbargos}\n`;
  }
  if (notas) intro += `<UNTRUSTED_USER_NOTES>\n${notas}\n</UNTRUSTED_USER_NOTES>\n`;
  intro += '\nDocumentos processuais submetidos a análise:\n';
  partes.push({ kind: 'text', text: intro });

  for (const f of req.files) {
    const nome = f.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const formato = f.mimeType === 'application/pdf' ? 'pdf' : 'texto extraído do PDF, com marcadores de página [p. N]';
    partes.push({ kind: 'text', text: `<UNTRUSTED_DOCUMENT_CONTENT filename="${nome}" role="${ROTULO_PAPEL[f.role]}" format="${formato}">` });
    if (f.mimeType === 'application/pdf' && f.dataBase64) {
      partes.push({ kind: 'pdf', name: nome.endsWith('.pdf') ? nome : `${nome}.pdf`, base64: f.dataBase64.replace(/\s/g, '') });
    } else if (f.textPreview) {
      const { sanitized, alertas: w } = sanitizeUntrustedInput(f.textPreview, f.name);
      avisos.push(...w);
      partes.push({ kind: 'text', text: sanitized });
    }
    partes.push({ kind: 'text', text: '</UNTRUSTED_DOCUMENT_CONTENT>' });
  }
  return { partes, avisos };
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
export function enriquecer(out: ModelOutput, meta: AdmissibilityAnalysisResult['meta'], entradas?: Partial<EntradasPrazo>, stj?: OpcoesBaseStj): AdmissibilityAnalysisResult {
  const entradasPrazo = EntradasPrazoSchema.parse(entradas ?? {});
  return {
    ...out,
    entradasPrazo,
    verificacoes: verificarPrazos(out, entradasPrazo),
    precedentes: verificarResultado(out),
    sobrestamento: sobrestamentoInicial(out, stj),
    preparo: preparoInicial(out),
    meta,
  };
}

/**
 * Temas do STJ parecidos com a matéria: busca na base oficial pelo texto do recurso e do acórdão (e pelos temas citados
 * nas peças). Devolve a lista para o prompt e para as sugestões da tela de sobrestamento.
 */
export function candidatosStj(req: AnalyzeRequest, indice: IndiceTemas): TemaEncontrado[] {
  const textos = req.files.filter((f) => f.role !== 'guia_preparo' && f.textPreview).map((f) => f.textPreview!);
  const consulta = [req.notes ?? '', ...textos].join('\n').slice(0, 400_000);
  if (consulta.trim().length < 40) return [];
  const out = new Map<string, TemaEncontrado>();
  const add = (t: TemaEncontrado) => out.has(`${t.especie}${t.numero}`) || out.set(`${t.especie}${t.numero}`, t);
  for (const n of temasCitados(consulta)) {
    const t = temaPorNumero(indice, n);
    if (t) add({ ...t, pontuacao: 0 });
  }
  const termosConsulta = prepararConsulta(indice, consulta);
  buscarTemas(indice, termosConsulta, { limite: 10, fases: ['pendente', 'julgado'] }).forEach(add);
  buscarTemas(indice, termosConsulta, { limite: 5, fases: ['pendente'] }).forEach(add);
  return [...out.values()].slice(0, 18);
}

const ROTULO_SUSP: Record<TemaStj['suspensao'], string> = { determinada: 'há ordem de suspensão', nao_determinada: 'sem ordem de suspensão', nao_informada: 'suspensão não informada' };

export function textoCandidatosStj(c: TemaEncontrado[], atualizadaEm: string): string {
  if (!c.length) return '';
  const linhas = c.map(
    (t) =>
      `- ${t.especie === 'relevancia' ? 'Tema de relevância' : 'Tema repetitivo'} ${t.numero}/STJ (${t.situacao}; ${ROTULO_SUSP[t.suspensao]}). Questão: ${t.questao.slice(0, 420)}${
        t.tese ? ` Tese: ${t.tese.slice(0, 260)}` : ''
      }`,
  );
  return [
    `\nTEMAS DO STJ NA BASE OFICIAL (dados abertos do STJ, consultados em ${atualizadaEm.slice(0, 10)}): selecionados por semelhança de texto com as peças; podem não ter relação com o caso.`,
    'Use esta lista como referência confiável de número, situação, questão e ordem de suspensão. Em "temasRepetitivos", inclua apenas os temas cuja questão de direito coincida com a do recurso (explique a pertinência) e copie número, situação e suspensão desta lista. Para temas do STJ fora da lista, só cite o número se tiver certeza.',
    ...linhas,
  ].join('\n');
}

export interface ResultadoAnalise {
  data: AdmissibilityAnalysisResult;
  avisosSeguranca: AlertaInjecao[];
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

  etapa('Consultando a base de temas do STJ…');
  const base = await baseStj(8000);
  const candidatos = base ? candidatosStj(req, base.indice) : [];
  if (base && candidatos.length) partes.push({ kind: 'text', text: textoCandidatosStj(candidatos, base.atualizadaEm) });
  const stj: OpcoesBaseStj = base ? { base: base.indice, consultadoEm: base.atualizadaEm, sugestoes: candidatos } : {};

  const resolvido = MODELO_FIXO[req.provider] ? { id: MODELO_FIXO[req.provider]!, nivel: null } : await resolverModelo(req.provider, req.model, apiKey);
  const model = resolvido.id;
  const impl = PROVEDORES_IMPL[req.provider];
  const jsonSchema = modelOutputJsonSchema();

  let tentativaPartes = partes;
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    etapa(
      tentativa === 1
        ? `Consultando o motor ${req.provider.toUpperCase()} (${resolvido.nivel ? `${ROTULO_NIVEL[resolvido.nivel].toLowerCase()}: ` : ''}${model})…`
        : 'Corrigindo resposta fora do formato…',
    );
    const texto = await impl.executar({ apiKey, model, system: montarPromptSistema(req.instrucoes), partes: tentativaPartes, jsonSchema, signal });
    etapa('Validando a estrutura da resposta…');
    const r = interpretarSaida(texto);
    if (r.ok) {
      etapa('Recalculando prazos e verificando precedentes…');
      const data = enriquecer(r.data, { provedor: req.provider, modelo: model, geradoEm: new Date().toISOString() }, req.prazo, stj);
      return { data, avisosSeguranca: avisos };
    }
    ultimoErro = r.erro;
    tentativaPartes = [...partes, { kind: 'text', text: `\nA resposta anterior foi rejeitada: ${r.erro} Responda novamente seguindo estritamente o schema.` }];
  }
  throw new ProviderError(`${ultimoErro} Tente novamente ou troque o motor.`, 502, false);
}
