import { z } from 'zod';
import { AdmissibilityAnalysisResultSchema, type AdmissibilityAnalysisResult } from './schema';
import { ROTULO_CONCLUSAO } from './sobrestamento';

/**
 * Registro (caso) gravado na nuvem: SOMENTE dados extraídos, calculados e cadastrados.
 * Nunca contém PDFs, texto integral das peças nem base64: o schema descarta qualquer campo
 * desconhecido, e os campos de texto têm teto de tamanho.
 */

export const STATUS_CASO = ['em_analise', 'revisado', 'concluido'] as const;
export const StatusCasoSchema = z.enum(STATUS_CASO);
export type StatusCaso = (typeof STATUS_CASO)[number];

/** Teto do JSON de um registro (o Firestore limita cada documento a 1 MiB). */
export const MAX_BYTES_REGISTRO = 900_000;

export const RegistroDadosSchema = AdmissibilityAnalysisResultSchema;
export type RegistroDados = AdmissibilityAnalysisResult;

export const RegistroNovoSchema = z.object({
  dados: RegistroDadosSchema,
  status: StatusCasoSchema.optional(),
});
export const RegistroAtualizacaoSchema = RegistroNovoSchema.extend({
  baseVersao: z.number().int().min(1),
});

export interface Autor {
  id: string;
  nome: string;
}

export interface CasoResumo {
  id: string;
  numeroProcesso: string;
  materia: string;
  status: StatusCaso;
  versao: number;
  criadoPor: Autor;
  criadoEm: string;
  atualizadoPor: Autor;
  atualizadoEm: string;
}

export interface Caso extends CasoResumo {
  dados: RegistroDados;
}

export interface EntradaHistorico {
  versao: number;
  por: Autor;
  em: string;
  resumo: string[];
}

// --- Número único do processo (CNJ, Res. 65/2008) -----------------------------------------------------

export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** Valida NNNNNNN-DD.AAAA.J.TR.OOOO e o dígito verificador (módulo 97). */
export function validarCNJ(numero: string): { valido: boolean; motivo?: string } {
  const d = soDigitos(numero);
  if (d.length !== 20) return { valido: false, motivo: 'O número do processo deve ter 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO).' };
  const [nnnnnnn, dv, aaaa, j, tr, oooo] = [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13), d.slice(13, 14), d.slice(14, 16), d.slice(16, 20)];
  const resto = BigInt(`${nnnnnnn}${aaaa}${j}${tr}${oooo}00`) % 97n;
  const esperado = String(98n - resto).padStart(2, '0');
  return esperado === dv ? { valido: true } : { valido: false, motivo: `Dígito verificador inválido (esperado ${esperado}). Confira o número do processo.` };
}

// --- Resumo das alterações entre duas versões ----------------------------------------------------------

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function resumirAlteracoes(antigo: RegistroDados | null, novo: RegistroDados): string[] {
  if (!antigo) return ['Registro criado'];
  const r: string[] = [];

  const campos = (Object.keys(novo.processo) as Array<keyof typeof novo.processo>).filter((k) => !igual(novo.processo[k], antigo.processo[k]));
  if (campos.length) r.push(`Dados do processo: ${campos.join(', ')}`);
  if (!igual(novo.recursosAnalisados, antigo.recursosAnalisados)) r.push('Recursos analisados');

  let status = 0;
  let notas = 0;
  let outros = 0;
  const velhos = new Map(antigo.checklistSecoes.flatMap((s) => s.itens.map((i) => [`${s.secaoCodigo}/${i.id}`, i] as const)));
  for (const s of novo.checklistSecoes) {
    for (const it of s.itens) {
      const o = velhos.get(`${s.secaoCodigo}/${it.id}`);
      if (!o) outros++;
      else {
        if (o.status !== it.status) status++;
        if ((o.observacaoAssessor ?? '') !== (it.observacaoAssessor ?? '')) notas++;
        if (o.analiseTecnica !== it.analiseTecnica || o.fundamentoLegal !== it.fundamentoLegal) outros++;
      }
    }
  }
  if (status) r.push(`Checklist: ${status} status alterado(s)`);
  if (notas) r.push(`Checklist: ${notas} anotação(ões) do assessor`);
  if (outros) r.push(`Checklist: ${outros} item(ns) com análise alterada`);

  if (!igual(novo.diagnosticoGeral, antigo.diagnosticoGeral)) r.push('Diagnóstico geral');

  const a = antigo.minutaDecisao1VP;
  const n = novo.minutaDecisao1VP;
  const m: string[] = [];
  if (a.cabecalho !== n.cabecalho) m.push('cabeçalho');
  if (a.relatorio !== n.relatorio) m.push('relatório');
  n.capitulosFundamentacao.forEach((c, i) => {
    if (!igual(c, a.capitulosFundamentacao[i])) m.push(`capítulo ${i + 1}`);
  });
  if (n.capitulosFundamentacao.length !== a.capitulosFundamentacao.length) m.push('nº de capítulos');
  if (a.dispositivoFinal !== n.dispositivoFinal) m.push('dispositivo');
  if ((a.advertenciaRecursual ?? '') !== (n.advertenciaRecursual ?? '')) m.push('advertência recursal');
  if (m.length) r.push(`Minuta: ${m.join(', ')}`);

  if (!igual(novo.entradasPrazo, antigo.entradasPrazo)) r.push('Prazos: datas, feriados ou interposição');

  const pa = new Map((antigo.precedentes ?? []).map((c) => [c.id, c]));
  const pn = novo.precedentes ?? [];
  const conferidos = pn.filter((c) => !igual(c.conferencia, pa.get(c.id)?.conferencia ?? { situacao: 'pendente' })).length;
  const novos = pn.filter((c) => !pa.has(c.id)).length;
  if (conferidos) r.push(`Precedentes: ${conferidos} conferência(s)`);
  if (novos) r.push(`Precedentes: ${novos} nova(s) citação(ões)`);

  if (!igual(novo.sobrestamento, antigo.sobrestamento)) {
    const c = novo.sobrestamento?.conclusao;
    r.push(c && c !== antigo.sobrestamento?.conclusao ? `Sobrestamento: ${ROTULO_CONCLUSAO[c].toLowerCase()}` : 'Sobrestamento: temas');
  }

  return r.slice(0, 9);
}
