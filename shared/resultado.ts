import type { AdmissibilityAnalysisResult, FundamentoRecurso } from './schema';

/** Resultado do exame em uma de três formas: negar seguimento ou admitir o processamento, total ou parcial. */
export type ResultadoAdmissibilidade = 'negar_seguimento' | 'admitir_parcial' | 'admitir_total';

export const ROTULO_RESULTADO: Record<ResultadoAdmissibilidade, string> = {
  negar_seguimento: 'Negar seguimento',
  admitir_parcial: 'Admitir processamento (parcial)',
  admitir_total: 'Admitir processamento (total)',
};

/**
 * O resultado informado pela IA; nas análises que não o trazem, deduzido dos fundamentos (todos rejeitados, todos
 * acolhidos ou parte) ou, na falta deles, do texto do diagnóstico.
 */
export function resultadoAdmissibilidade(d: Pick<AdmissibilityAnalysisResult, 'resultadoAdmissibilidade' | 'fundamentosRecurso' | 'diagnosticoGeral'>): ResultadoAdmissibilidade {
  if (d.resultadoAdmissibilidade) return d.resultadoAdmissibilidade;
  const f = d.fundamentosRecurso ?? [];
  if (f.length) {
    const ac = f.filter((x) => x.conclusao === 'acolhido').length;
    return ac === 0 ? 'negar_seguimento' : ac === f.length ? 'admitir_total' : 'admitir_parcial';
  }
  const t = `${d.diagnosticoGeral.probabilidadeAdmissao} ${d.diagnosticoGeral.incisoArt1030Principal}`.toLowerCase();
  const nega = /inadmi|negativa|negar|nego|n[ãa]o admit|sobrest/.test(t);
  const admite = /(?<!in)admiss[ãa]o|(?<!in)admit|remessa|juízo positivo/.test(t);
  if (admite && nega) return /parcial/.test(t) ? 'admitir_parcial' : 'negar_seguimento';
  return admite ? (/parcial/.test(t) ? 'admitir_parcial' : 'admitir_total') : 'negar_seguimento';
}

export const ROTULO_CONCLUSAO_FUNDAMENTO: Record<FundamentoRecurso['conclusao'], string> = { acolhido: 'Acolhido', rejeitado: 'Rejeitado' };
