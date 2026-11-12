export interface GuidelineSummary {
  marco: string;
  data: string;
  efeito: string;
}

export interface SumulaInfo {
  numero: string;
  tribunal: 'STJ' | 'STF';
  tema: string;
  aplicacao: string;
  usoPratico: string;
}

export interface SaidaArt1030 {
  inciso: string;
  quando: string;
  recurso: string;
  observacoes: string;
}

export const LINHA_TEMPO_2026: GuidelineSummary[] = [
  {
    data: '07/10/2026',
    marco: 'Primeira questão sob o rito da Relevância no STJ',
    efeito: 'Passam a existir temas de relevância com a mesma numeração dos repetitivos.',
  },
  {
    data: '03/09/2026',
    marco: 'Vigência da Lei 15.484/2026 e Emenda Regimental STJ 55/2026',
    efeito: 'Tópico de relevância obrigatório para acórdãos publicados a partir desta data; novo art. 1.030, I, "c", do CPC.',
  },
  {
    data: '21/08/2026',
    marco: 'Emenda Regimental STJ 55/2026',
    efeito: 'Regula o rito no STJ (arts. 255-A e ss.) e a atuação das Vice-Presidências de origem.',
  },
  {
    data: '04/08/2026',
    marco: 'Promulgação da Lei 15.484/2026',
    efeito: 'Cria o art. 1.035-A e altera os arts. 927, 932, 979, 988, 998, 1.030, 1.039 e 1.042 do CPC.',
  },
  {
    data: '01/07/2026',
    marco: 'Emenda Regimental STJ 53/2026 (art. 343-A do RISTJ)',
    efeito: 'Resumo estruturado nas petições de REsp (exigência gradual sob IN STJ/GP 42/2026).',
  },
];

export const TABELA_ART_1030: SaidaArt1030[] = [
  {
    inciso: 'I, "a"',
    quando: 'RE sobre questão a que o STF não reconheceu repercussão geral, ou contra acórdão conforme tese de repercussão geral',
    recurso: 'Agravo Interno (art. 1.030, § 2º c/c art. 1.021)',
    observacoes: 'Julgado pelo Órgão Especial do TJPR. Agravo do art. 1.042 é ERRO GROSSEIRO.',
  },
  {
    inciso: 'I, "b"',
    quando: 'RE ou REsp contra acórdão conforme tese de recurso repetitivo (STF ou STJ)',
    recurso: 'Agravo Interno (art. 1.030, § 2º)',
    observacoes: 'Cabe juízo de retratação pela 1ª Vice-Presidência se demonstrada distinção (distinguishing).',
  },
  {
    inciso: 'I, "c" [2026]',
    quando: 'REsp sobre questão a que o STJ não reconheceu relevância, ou acórdão conforme tese de relevância',
    recurso: 'Agravo Interno (art. 1.030, § 2º)',
    observacoes: 'Introduzido pela Lei 15.484/2026. NÃO cabe agravo do art. 1.042!',
  },
  {
    inciso: 'II',
    quando: 'Acórdão diverge de tese de repercussão geral, repetitivo ou relevância',
    recurso: 'Sem recurso nesta fase',
    observacoes: 'Envio ao órgão julgador originário (Câmara Cível/Criminal) para juízo de retratação.',
  },
  {
    inciso: 'III',
    quando: 'Sobrestar recurso que trate de controvérsia repetitiva/relevância ainda não decidida',
    recurso: 'Agravo Interno (art. 1.030, § 2º)',
    observacoes: 'Suspensão dos autos aguardando tese vinculante do tribunal superior.',
  },
  {
    inciso: 'IV',
    quando: 'Selecionar o recurso como representativo da controvérsia (art. 1.036, § 6º; art. 255-D RISTJ)',
    recurso: 'Sem recurso previsto no art. 1.030',
    observacoes: 'Remessa ao STJ/STF para afetação e fixação de tese de repercussão geral ou relevância.',
  },
  {
    inciso: 'V',
    quando: 'Juízo de admissibilidade positivo (remessa) ou negativo (inadmissão por falta de requisitos, súmulas etc.)',
    recurso: 'Agravo em REsp/RE (art. 1.042 do CPC)',
    observacoes: 'Prazo de 15 dias, sem custas, interposto na origem e remetido ao tribunal superior. Agravo interno é ERRO GROSSEIRO.',
  },
];

export const SUMULAS_MAIS_FREQUENTES: SumulaInfo[] = [
  {
    numero: 'Súmula 7/STJ',
    tribunal: 'STJ',
    tema: 'Reexame de fatos e provas não cabe em REsp',
    aplicacao: 'REsp (alíneas "a" e "c")',
    usoPratico: 'Mais frequente. A decisão deve obrigatoriamente indicar qual premissa fática teria que ser alterada.',
  },
  {
    numero: 'Súmula 5/STJ',
    tribunal: 'STJ',
    tema: 'Interpretação de cláusula contratual não cabe em REsp',
    aplicacao: 'REsp',
    usoPratico: 'Contratos e cláusulas financeiras/seguros; distinguir de erro na qualificação jurídica.',
  },
  {
    numero: 'Súmula 83/STJ',
    tribunal: 'STJ',
    tema: 'Orientação do STJ firmada no mesmo sentido do acórdão recorrido',
    aplicacao: 'REsp (alíneas "c" e "a")',
    usoPratico: 'Impede o recurso quando o aresto já está em harmonia com a jurisprudência dominante.',
  },
  {
    numero: 'Súmula 13/STJ',
    tribunal: 'STJ',
    tema: 'Divergência entre julgados do mesmo tribunal não enseja REsp',
    aplicacao: 'REsp (alínea "c")',
    usoPratico: 'O acórdão paradigma deve obrigatoriamente provir de outro tribunal (ou do próprio STJ).',
  },
  {
    numero: 'Súmula 211/STJ',
    tribunal: 'STJ',
    tema: 'Inadmissível REsp quanto à matéria não debatida no aresto',
    aplicacao: 'REsp',
    usoPratico: 'Prequestionamento ficto (art. 1.025 CPC) só é admitido se foram opostos embargos E alegada ofensa ao art. 1.022 CPC.',
  },
  {
    numero: 'Súmula 126/STJ',
    tribunal: 'STJ',
    tema: 'Fundamento constitucional autônomo suficiente não atacado por RE',
    aplicacao: 'REsp',
    usoPratico: 'Se o aresto possuir base constitucional autônoma e não foi interposto RE, o REsp não é conhecido.',
  },
  {
    numero: 'Súmula 279/STF',
    tribunal: 'STF',
    tema: 'Reexame de provas não cabe em Recurso Extraordinário',
    aplicacao: 'RE',
    usoPratico: 'Equivalente da Súmula 7/STJ na esfera constitucional.',
  },
  {
    numero: 'Súmula 636/STF',
    tribunal: 'STF',
    tema: 'Ofensa reflexa ao princípio da legalidade não autoriza RE',
    aplicacao: 'RE',
    usoPratico: 'Aplicada juntamente ao Tema 660 de Repercussão Geral (contraditório, ampla defesa e devido processo legal).',
  },
  {
    numero: 'Súmula 283/STF',
    tribunal: 'STF',
    tema: 'Fundamento autônomo e suficiente não impugnado nas razões recursais',
    aplicacao: 'RE e REsp',
    usoPratico: 'Quando o acórdão traz múltiplos fundamentos e a parte recorrente deixa de rebater um deles.',
  },
  {
    numero: 'Súmula 284/STF',
    tribunal: 'STF',
    tema: 'Deficiência na fundamentação que impede a compreensão da controvérsia',
    aplicacao: 'RE e REsp',
    usoPratico: 'Argumentação genérica, ausência de indicação precisa de dispositivo violado.',
  },
  {
    numero: 'Súmula 115/STJ',
    tribunal: 'STJ',
    tema: 'Na instância especial é inexistente recurso sem procuração',
    aplicacao: 'REsp e RE',
    usoPratico: 'Antes de inadmitir por vício sanável, avaliar a intimação nos termos do art. 76 e art. 932, p. único.',
  },
];
