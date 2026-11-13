import type {
  AdmissibilityAnalysisResult,
  ConclusaoSobrestamento,
  ModelOutput,
  Sobrestamento,
  TemaSobrestamento,
} from './schema';

/**
 * Verificação de sobrestamento: a matéria do recurso se insere em tema repetitivo, de repercussão
 * geral ou de relevância com ordem de suspensão (CPC, arts. 1.030, III; 1.035, § 5º; 1.037, II)?
 * A IA só sugere temas; o enquadramento, a suspensão e a conclusão são registrados pelo assessor.
 */

export const ROTULO_CONCLUSAO: Record<ConclusaoSobrestamento, string> = {
  nao_verificado: 'Não verificado',
  sobrestar: 'Sobrestar o recurso (art. 1.030, III)',
  tema_sem_suspensao: 'Há tema pertinente, sem ordem de suspensão',
  nao_ha_tema: 'Matéria não afetada a tema',
};

export const ROTULO_ESPECIE: Record<TemaSobrestamento['especie'], string> = {
  repetitivo: 'Repetitivo',
  repercussao_geral: 'Repercussão geral',
  relevancia: 'Relevância',
};

export const ROTULO_SUSPENSAO: Record<TemaSobrestamento['suspensao'], string> = {
  determinada: 'Suspensão determinada',
  nao_determinada: 'Sem ordem de suspensão',
  a_conferir: 'Suspensão a conferir',
};

export const ROTULO_ENQUADRAMENTO: Record<TemaSobrestamento['enquadramento'], string> = {
  se_insere: 'A matéria se insere',
  nao_se_insere: 'Não se insere',
  a_verificar: 'Enquadramento a verificar',
};

export const ROTULO_SITUACAO_TEMA: Record<TemaSobrestamento['situacao'], string> = {
  afetado_pendente: 'Afetado, mérito pendente',
  julgado: 'Mérito julgado',
  desconhecida: 'Situação a conferir',
};

export function rotuloTema(t: Pick<TemaSobrestamento, 'numero' | 'tribunal'>): string {
  return t.numero.trim() ? `Tema ${t.numero.trim()}/${t.tribunal}` : `Tema sem número/${t.tribunal}`;
}

/** Página oficial do tema (ou a pesquisa de temas, se não houver número). */
export function linkTema(t: Pick<TemaSobrestamento, 'numero' | 'tribunal'>): string {
  const n = t.numero.replace(/\D/g, '');
  if (t.tribunal === 'STF') {
    return n ? `https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=${n}` : 'https://portal.stf.jus.br/jurisprudenciaRepercussao/pesquisarProcesso.asp';
  }
  return n
    ? `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=${n}&cod_tema_final=${n}`
    : 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/';
}

const idTema = (tribunal: string, numero: string, i: number) => `${tribunal}-${numero.replace(/\D/g, '') || `s${i}`}`;

/** Registro inicial a partir das indicações da IA: tudo fica "a verificar" até o assessor decidir. */
export function sobrestamentoInicial(out: Pick<ModelOutput, 'temasRepetitivos'>): Sobrestamento {
  const vistos = new Set<string>();
  const temas: TemaSobrestamento[] = [];
  (out.temasRepetitivos ?? []).forEach((t, i) => {
    const id = idTema(t.tribunal, t.numero, i);
    if (vistos.has(id)) return;
    vistos.add(id);
    temas.push({
      id,
      origem: 'ia',
      tribunal: t.tribunal,
      especie: t.especie,
      numero: t.numero.trim(),
      questao: t.questao,
      pertinencia: t.pertinencia,
      situacao: t.situacao,
      suspensao: t.suspensao === 'desconhecida' ? 'a_conferir' : t.suspensao,
      enquadramento: 'a_verificar',
    });
  });
  return { conclusao: 'nao_verificado', temas };
}

/** O registro gravado, ou o inicial para análises anteriores a esta verificação. */
export function obterSobrestamento(d: AdmissibilityAnalysisResult): Sobrestamento {
  return d.sobrestamento ?? sobrestamentoInicial(d);
}

export function novoTemaManual(tribunal: 'STJ' | 'STF', especie: TemaSobrestamento['especie'], numero: string, existentes: TemaSobrestamento[]): TemaSobrestamento {
  let id = idTema(tribunal, numero, existentes.length);
  while (existentes.some((t) => t.id === id)) id += '+';
  return { id, origem: 'assessor', tribunal, especie, numero: numero.trim(), questao: '', situacao: 'desconhecida', suspensao: 'a_conferir', enquadramento: 'a_verificar' };
}

/** Conclusão que decorre dos temas registrados, ou null se ainda falta conferir algo. */
export function conclusaoSugerida(s: Sobrestamento): ConclusaoSobrestamento | null {
  const inseridos = s.temas.filter((t) => t.enquadramento === 'se_insere');
  if (inseridos.some((t) => t.suspensao === 'determinada')) return 'sobrestar';
  if (s.temas.some((t) => t.enquadramento === 'a_verificar')) return null;
  if (inseridos.length === 0) return 'nao_ha_tema';
  if (inseridos.some((t) => t.suspensao === 'a_conferir')) return null;
  return 'tema_sem_suspensao';
}

const mencionaSobrestamento = (d: AdmissibilityAnalysisResult) => {
  const m = d.minutaDecisao1VP;
  const texto = [d.diagnosticoGeral.incisoArt1030Principal, m.dispositivoFinal, ...m.capitulosFundamentacao.map((c) => `${c.incisoArt1030} ${c.conteudo}`)].join(' ');
  return /sobrest|suspens|1\.030,?\s*(inciso\s*)?III\b/i.test(texto);
};

/** Incoerências entre o registro do assessor e o restante da análise. */
export function avisosSobrestamento(d: AdmissibilityAnalysisResult): string[] {
  const s = obterSobrestamento(d);
  const avisos: string[] = [];
  const sugerida = conclusaoSugerida(s);
  if (s.conclusao === 'nao_verificado') {
    if (s.temas.some((t) => t.suspensao === 'determinada')) avisos.push('Há tema indicado com ordem de suspensão. Confira o enquadramento antes de decidir pela admissibilidade.');
  } else if (sugerida && sugerida !== s.conclusao) {
    avisos.push(`A conclusão registrada difere do que os temas indicam (${ROTULO_CONCLUSAO[sugerida].toLowerCase()}).`);
  }
  if (s.conclusao === 'sobrestar' && !mencionaSobrestamento(d)) {
    avisos.push('A conclusão é pelo sobrestamento, mas a minuta não prevê o art. 1.030, III. Ajuste a minuta.');
  }
  if (s.conclusao === 'sobrestar' && !s.temas.some((t) => t.enquadramento === 'se_insere' && t.suspensao === 'determinada')) {
    avisos.push('Indique o tema com suspensão em que a matéria se insere.');
  }
  return avisos;
}
