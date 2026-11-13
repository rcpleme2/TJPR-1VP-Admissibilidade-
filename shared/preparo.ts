import type { AdmissibilityAnalysisResult, ModelOutput, PreparoItem, SituacaoPreparo } from './schema';

/**
 * Preparo dos recursos (custas e porte de remessa e retorno) ou dispensa por gratuidade ou isenção.
 * A IA aponta o que encontrou nas guias e nos autos; o assessor confere e marca cada recurso.
 */

export const ROTULO_PREPARO: Record<SituacaoPreparo, string> = {
  recolhido: 'Recolhido',
  gratuidade: 'Justiça gratuita',
  isencao: 'Isento',
  insuficiente: 'Recolhido a menor',
  nao_comprovado: 'Não comprovado',
  a_verificar: 'A verificar',
};

export type Especie = 'REsp' | 'RE' | null;
export const especie = (t: string): Especie => (/especial|resp/i.test(t) ? 'REsp' : /extraordin|\bre\b/i.test(t) ? 'RE' : null);

/** Um item por recurso em exame, com o que a IA apontou; o que ela não apontou fica "a verificar". */
export function preparoInicial(out: Pick<ModelOutput, 'recursosAnalisados' | 'preparoRecursos'>): PreparoItem[] {
  const ia = [...(out.preparoRecursos ?? [])];
  return out.recursosAnalisados.map((r) => {
    const i = ia.findIndex((p) => especie(p.recurso) !== null && especie(p.recurso) === especie(r.tipo));
    const p = i >= 0 ? ia.splice(i, 1)[0] : undefined;
    return {
      id: r.id,
      recurso: r.tipo,
      situacao: !p || p.situacao === 'desconhecido' ? 'a_verificar' : p.situacao,
      fundamento: p?.fundamento ?? '',
      valorRecolhido: p?.valorRecolhido,
      conferido: false,
      origem: 'ia',
    };
  });
}

export function obterPreparo(d: AdmissibilityAnalysisResult): PreparoItem[] {
  return d.preparo ?? preparoInicial(d);
}

export function avisosPreparo(itens: PreparoItem[]): string[] {
  const avisos: string[] = [];
  for (const p of itens) {
    if (p.situacao === 'nao_comprovado') {
      avisos.push(`${p.recurso}: preparo não comprovado. Antes de reconhecer a deserção, intime-se o recorrente para recolher em dobro (CPC, art. 1.007, § 4º).`);
    } else if (p.situacao === 'insuficiente') {
      avisos.push(`${p.recurso}: preparo insuficiente. Intime-se para complementar em 5 dias (CPC, art. 1.007, § 2º).`);
    } else if (p.situacao === 'a_verificar') {
      avisos.push(`${p.recurso}: preparo ainda não verificado.`);
    }
  }
  return avisos;
}

export const preparoPendente = (itens: PreparoItem[]) => itens.filter((p) => !p.conferido || p.situacao === 'a_verificar').length;
