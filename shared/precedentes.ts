import { FAIXAS_SUMULAS } from './regras';
import { BASE_INICIAL, type EntradaBase } from './precedentesBase';
import type { AdmissibilityAnalysisResult, CitacaoPrecedente, ModelOutput } from './schema';

type Tribunal = 'STJ' | 'STF';
type Tipo = CitacaoPrecedente['tipo'];

export interface CitacaoBruta {
  tipo: Tipo;
  tribunal: Tribunal | null;
  numero: string;
  origem: string;
  contexto: string;
}

export interface TextoOrigem {
  origem: string;
  texto: string;
}

const NUM = String.raw`(\d{1,2}\.\d{3}|\d{1,4})`;
/** Número seguido de ")" é enumerador de item (ex.: "3) INADMITO"), não precedente. */
const NUM_FIM = String.raw`(?!\d|\s*\))`;
const RE_TRIBUNAL = new RegExp(
  String.raw`\s*(?:/|\s(?:d[oa]s?|n[oa]s?)\s+|\s*\(\s*)\s*(STJ|STF|Superior Tribunal de Justi[çc]a|Supremo Tribunal Federal)\b\)?`,
  'iy',
);
const RE_NUM_SEQ = new RegExp(String.raw`\s*(?:n(?:[º°o]|\.|[úu]mero)?\.?\s*)?${NUM}${NUM_FIM}`, 'y');
const RE_SEP = /\s*(?:,|;|\/|\be\b|\bou\b)\s*/iy;

function normTribunal(t: string): Tribunal {
  return /^stj$|superior/i.test(t) ? 'STJ' : 'STF';
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function contextoAo(texto: string, ini: number, fim: number, raio = 140): string {
  const a = Math.max(0, ini - raio);
  const b = Math.min(texto.length, fim + raio);
  return (a > 0 ? '…' : '') + texto.slice(a, b).replace(/\s+/g, ' ').trim() + (b < texto.length ? '…' : '');
}

/** Lê uma sequência "5, 7 e 83 do STJ e 283 do STF" a partir de `pos`. */
function lerSequencia(texto: string, pos: number): { itens: Array<{ numero: string; tribunal: Tribunal | null }>; fim: number } {
  const itens: Array<{ numero: string; tribunal: Tribunal | null }> = [];
  let pendentes: number[] = [];
  let ultimoTribunal: Tribunal | null = null;
  let i = pos;
  for (let guard = 0; guard < 40; guard++) {
    RE_NUM_SEQ.lastIndex = i;
    const m = RE_NUM_SEQ.exec(texto);
    if (!m) break;
    itens.push({ numero: m[1].replace('.', ''), tribunal: null });
    pendentes.push(itens.length - 1);
    i = RE_NUM_SEQ.lastIndex;
    RE_TRIBUNAL.lastIndex = i;
    const t = RE_TRIBUNAL.exec(texto);
    if (t) {
      ultimoTribunal = normTribunal(t[1]);
      for (const idx of pendentes) itens[idx].tribunal = ultimoTribunal;
      pendentes = [];
      i = RE_TRIBUNAL.lastIndex;
    }
    RE_SEP.lastIndex = i;
    const s = RE_SEP.exec(texto);
    if (!s) break;
    // só continua se, após o separador, vier outro número
    RE_NUM_SEQ.lastIndex = RE_SEP.lastIndex;
    if (!RE_NUM_SEQ.test(texto)) break;
    i = RE_SEP.lastIndex;
  }
  // números finais sem tribunal herdam o último tribunal citado na sequência
  for (const idx of pendentes) itens[idx].tribunal = ultimoTribunal;
  return { itens, fim: i };
}

const CLASSES_STF = new Set(['RE', 'ARE', 'ADI', 'ADC', 'ADPF', 'AI', 'RCL', 'SS', 'SL']);
const CLASSES_STJ = new Set(['RESP', 'ARESP', 'ERESP', 'EARESP']);

/** Extrai citações de súmulas, súmulas vinculantes, temas e acórdãos de um texto. */
export function extrairCitacoes(texto: string, origem: string): CitacaoBruta[] {
  const out: CitacaoBruta[] = [];
  if (!texto) return out;

  // Súmulas (inclui vinculantes e "SV")
  const reSum = /\b(?:S[úu]mulas?|S[úu]m\.)\s+(Vinculantes?\s+)?|\bSV\s+(?=\d)/giu;
  let m: RegExpExecArray | null;
  while ((m = reSum.exec(texto))) {
    const vinculante = Boolean(m[1]) || /^SV/i.test(m[0]);
    const { itens, fim } = lerSequencia(texto, m.index + m[0].length);
    if (itens.length === 0) continue;
    for (const it of itens) {
      out.push({
        tipo: vinculante ? 'sumula_vinculante' : 'sumula',
        tribunal: vinculante ? 'STF' : it.tribunal,
        numero: it.numero,
        origem,
        contexto: contextoAo(texto, m.index, fim),
      });
    }
    reSum.lastIndex = fim;
  }

  // Temas (repetitivos STJ / repercussão geral STF / relevância STJ)
  const reTema = /\bTemas?\s+(?:(?:Repetitivos?|de Repercuss[ãa]o Geral|de Relev[âa]ncia)\s+)?/giu;
  while ((m = reTema.exec(texto))) {
    const { itens, fim } = lerSequencia(texto, m.index + m[0].length);
    if (itens.length === 0) continue;
    const depois = texto.slice(fim, fim + 80);
    const antes = texto.slice(Math.max(0, m.index - 40), fim);
    for (const it of itens) {
      let trib = it.tribunal;
      if (!trib) {
        if (/repercuss[ãa]o geral/i.test(depois + antes)) trib = 'STF';
        else if (/repetitiv|relev[âa]ncia/i.test(depois + antes)) trib = 'STJ';
      }
      out.push({ tipo: 'tema', tribunal: trib, numero: it.numero, origem, contexto: contextoAo(texto, m.index, fim) });
    }
    reTema.lastIndex = fim;
  }

  // Acórdãos / processos paradigma (REsp 1.234.567/PR, AgInt no AREsp 1.890.112, ARE 1.576.450 ...)
  const reAc =
    /\b((?:(?:AgInt|AgRg|EDcl|ED|AgR|EAREsp)\s+(?:nos?\s+)?)*)(AREsp|REsp|EREsp|ARE|RE|ADI|ADC|ADPF|Rcl|RHC|HC|MS|RMS|AI)\s+(?:n[º°o.]*\s*)?(\d{1,3}(?:\.\d{3}){1,2}|\d{4,7})(?:\s*\/\s*([A-Z]{2}))?/g;
  while ((m = reAc.exec(texto))) {
    const classe = m[2];
    const up = classe.toUpperCase();
    const tribunal: Tribunal | null = CLASSES_STF.has(up) ? 'STF' : CLASSES_STJ.has(up) ? 'STJ' : null;
    const numero = `${(m[1] || '').trim()} ${classe} ${m[3]}${m[4] ? '/' + m[4] : ''}`.trim().replace(/\s+/g, ' ');
    out.push({ tipo: 'acordao', tribunal, numero, origem, contexto: contextoAo(texto, m.index, m.index + m[0].length) });
  }

  return out;
}

export function chaveBase(e: Pick<EntradaBase, 'tipo' | 'tribunal' | 'numero'>): string {
  return `${e.tipo}|${e.tribunal}|${e.numero}`;
}

export function rotulo(tipo: Tipo, tribunal: Tribunal | null, numero: string): string {
  const t = tribunal ? `/${tribunal}` : '';
  switch (tipo) {
    case 'sumula':
      return `Súmula ${numero}${t}`;
    case 'sumula_vinculante':
      return `Súmula Vinculante ${numero}`;
    case 'tema':
      return `Tema ${numero}${t}`;
    default:
      return numero;
  }
}

export function linkOficial(tipo: Tipo, tribunal: Tribunal | null, numero: string): string {
  const q = encodeURIComponent;
  if (tipo === 'acordao') {
    const num = numero.replace(/[^\d]/g, '');
    return tribunal === 'STF'
      ? `https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&queryString=${q(num)}`
      : `https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${q(num)}`;
  }
  if (tipo === 'tema') {
    return tribunal === 'STF'
      ? 'https://portal.stf.jus.br/jurisprudenciaRepercussao/pesquisarProcesso.asp'
      : 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/';
  }
  if (tipo === 'sumula_vinculante') {
    return `https://jurisprudencia.stf.jus.br/pages/search?base=sumulas&queryString=${q('súmula vinculante ' + numero)}`;
  }
  return tribunal === 'STF'
    ? `https://jurisprudencia.stf.jus.br/pages/search?base=sumulas&queryString=${q('súmula ' + numero)}`
    : 'https://scon.stj.jus.br/SCON/sumanot/';
}

export function verificarUma(
  c: { tipo: Tipo; tribunal: Tribunal | null; numero: string; contexto: string },
  base: Map<string, EntradaBase>,
): CitacaoPrecedente['verificacao'] {
  if (c.tipo === 'acordao') {
    return {
      status: 'requer_conferencia',
      mensagem: 'Número de processo não pode ser validado automaticamente (sem base oficial offline). Confira existência e teor no portal do tribunal.',
      coerencia: 'nao_aplicavel',
    };
  }
  if (c.tipo === 'tema') {
    const e = c.tribunal ? base.get(chaveBase({ tipo: 'tema', tribunal: c.tribunal, numero: c.numero })) : undefined;
    if (e) return avaliarEntrada(e, c.contexto);
    return {
      status: c.tribunal ? 'requer_conferencia' : 'tribunal_indefinido',
      mensagem: c.tribunal
        ? 'Temas repetitivos/de repercussão geral não constam da base local. Confira número, tese e situação (afetado, julgado, trânsito) no portal oficial.'
        : 'Tribunal não identificado na citação (STJ ou STF?). Defina o tribunal e confira o tema.',
      coerencia: 'nao_aplicavel',
    };
  }
  // súmula / súmula vinculante
  if (!c.tribunal) {
    return { status: 'tribunal_indefinido', mensagem: 'Citação sem indicação do tribunal (STJ ou STF). Complete a citação na minuta.', coerencia: 'nao_aplicavel' };
  }
  const n = Number(c.numero);
  const faixa = c.tipo === 'sumula_vinculante' ? FAIXAS_SUMULAS.SV : FAIXAS_SUMULAS[c.tribunal];
  const e = base.get(chaveBase({ tipo: c.tipo, tribunal: c.tribunal, numero: c.numero }));
  if (e) return avaliarEntrada(e, c.contexto);
  if (n < 1 || n > faixa.max) {
    return {
      status: 'inexistente',
      mensagem: faixa.exata
        ? `O ${c.tribunal} não editou súmula de número ${n} (a numeração vai até ${faixa.max}). Possível citação inventada ou errada.`
        : `Número acima da faixa conhecida (${faixa.max}). Provável citação inexistente; confira no portal oficial.`,
      coerencia: 'nao_aplicavel',
    };
  }
  return {
    status: 'nao_encontrada_na_base',
    mensagem: 'Número plausível, mas a súmula não consta da base local. Confira o enunciado no portal oficial e, se desejar, cadastre-a na base.',
    coerencia: 'nao_aplicavel',
  };
}

function avaliarEntrada(e: EntradaBase, contexto: string): CitacaoPrecedente['verificacao'] {
  const ctx = semAcento(contexto);
  const coerencia = e.palavrasChave.length === 0 ? 'nao_aplicavel' : e.palavrasChave.some((k) => ctx.includes(semAcento(k))) ? 'ok' : 'verificar';
  if (e.situacao !== 'vigente') {
    return {
      status: 'cancelada_ou_superada',
      mensagem: `Consta da base como ${e.situacao.toUpperCase()}. Não deve fundamentar a decisão sem ressalva.`,
      enunciadoOficial: e.enunciado,
      coerencia,
    };
  }
  return {
    status: 'confirmada',
    mensagem:
      coerencia === 'verificar'
        ? 'Existe e está vigente na base, mas o contexto em que foi citada não menciona o assunto do enunciado. Confira se a aplicação é pertinente.'
        : 'Existe e está vigente na base local. Confira o enunciado no portal oficial antes de assinar.',
    enunciadoOficial: e.enunciado,
    coerencia,
  };
}

export function montarBase(custom: EntradaBase[] = []): Map<string, EntradaBase> {
  const base = new Map<string, EntradaBase>();
  for (const e of BASE_INICIAL) base.set(chaveBase(e), e);
  for (const e of custom) base.set(chaveBase(e), { ...e, fonte: 'usuario' });
  return base;
}

/** Percorre minuta, checklist e diagnóstico, coletando todo texto onde podem existir citações. */
export function coletarTextos(r: Pick<ModelOutput, 'minutaDecisao1VP' | 'checklistSecoes' | 'diagnosticoGeral'>): TextoOrigem[] {
  const t: TextoOrigem[] = [];
  const m = r.minutaDecisao1VP;
  t.push({ origem: 'Minuta › Relatório', texto: m.relatorio });
  m.capitulosFundamentacao.forEach((c, i) => t.push({ origem: `Minuta › Capítulo ${i + 1}`, texto: `${c.tituloCapitulo}\n${c.conteudo}` }));
  t.push({ origem: 'Minuta › Dispositivo', texto: m.dispositivoFinal });
  if (m.advertenciaRecursual) t.push({ origem: 'Minuta › Advertência', texto: m.advertenciaRecursual });
  for (const s of r.checklistSecoes) {
    for (const it of s.itens) {
      t.push({ origem: `Checklist › ${s.secaoCodigo} › ${it.titulo}`.slice(0, 90), texto: `${it.analiseTecnica}\n${it.fundamentoLegal ?? ''}` });
    }
  }
  t.push({ origem: 'Diagnóstico › Resumo', texto: r.diagnosticoGeral.resumoParecer });
  (r.diagnosticoGeral.principaisObicesIdentificados ?? []).forEach((o, i) => t.push({ origem: `Diagnóstico › Óbice ${i + 1}`, texto: o }));
  return t;
}

function idEstavel(tipo: Tipo, tribunal: Tribunal | null, numero: string): string {
  return `${tipo}:${tribunal ?? 'x'}:${numero}`.replace(/\s+/g, '_');
}

/**
 * Verificação automática. Preserva a conferência manual de citações já existentes (mesmo id)
 * e mantém as citações adicionadas manualmente pelo usuário.
 */
export function verificarPrecedentes(
  textos: TextoOrigem[],
  opcoes: { baseCustom?: EntradaBase[]; anteriores?: CitacaoPrecedente[] } = {},
): CitacaoPrecedente[] {
  const base = montarBase(opcoes.baseCustom);
  const anteriores = new Map((opcoes.anteriores ?? []).map((c) => [c.id, c]));

  const brutas = textos.flatMap(({ origem, texto }) => extrairCitacoes(texto, origem));

  // Citação sem tribunal herda o tribunal se o mesmo número aparece, em outro ponto, com um único tribunal.
  const tribunaisPorNumero = new Map<string, Set<Tribunal>>();
  for (const b of brutas) {
    if (!b.tribunal || b.tipo === 'acordao') continue;
    const k = `${b.tipo}|${b.numero}`;
    (tribunaisPorNumero.get(k) ?? tribunaisPorNumero.set(k, new Set()).get(k)!).add(b.tribunal);
  }
  for (const b of brutas) {
    if (b.tribunal || b.tipo === 'acordao') continue;
    const ts = tribunaisPorNumero.get(`${b.tipo}|${b.numero}`);
    if (ts && ts.size === 1) b.tribunal = [...ts][0];
  }

  const agrupadas = new Map<string, CitacaoPrecedente>();
  const contextos = new Map<string, string[]>();
  for (const b of brutas) {
    const id = idEstavel(b.tipo, b.tribunal, b.numero);
    const existente = agrupadas.get(id);
    if (existente) {
      if (existente.ocorrencias.length < 6) existente.ocorrencias.push({ origem: b.origem, contexto: b.contexto });
      contextos.get(id)!.push(b.contexto);
      continue;
    }
    contextos.set(id, [b.contexto]);
    agrupadas.set(id, {
      id,
      tipo: b.tipo,
      tribunal: b.tribunal,
      numero: b.numero,
      rotulo: rotulo(b.tipo, b.tribunal, b.numero),
      ocorrencias: [{ origem: b.origem, contexto: b.contexto }],
      verificacao: verificarUma(b, base),
      linkOficial: linkOficial(b.tipo, b.tribunal, b.numero),
      conferencia: anteriores.get(id)?.conferencia ?? { situacao: 'pendente' },
    });
  }
  // pertinência avaliada sobre TODAS as ocorrências (basta uma coerente)
  for (const [id, c] of agrupadas) {
    c.verificacao = verificarUma({ tipo: c.tipo, tribunal: c.tribunal, numero: c.numero, contexto: contextos.get(id)!.join(' ') }, base);
  }

  // reaplica verificação nas manuais e mantém as que o usuário cadastrou
  for (const prev of anteriores.values()) {
    if (prev.manual && !agrupadas.has(prev.id)) {
      agrupadas.set(prev.id, {
        ...prev,
        verificacao: verificarUma({ tipo: prev.tipo, tribunal: prev.tribunal, numero: prev.numero, contexto: prev.ocorrencias[0]?.contexto ?? '' }, base),
      });
    }
  }

  const peso: Record<CitacaoPrecedente['verificacao']['status'], number> = {
    inexistente: 0,
    cancelada_ou_superada: 1,
    tribunal_indefinido: 2,
    nao_encontrada_na_base: 3,
    requer_conferencia: 4,
    confirmada: 5,
  };
  return [...agrupadas.values()].sort(
    (a, b) => peso[a.verificacao.status] - peso[b.verificacao.status] || a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }),
  );
}

export function verificarResultado(
  r: Pick<AdmissibilityAnalysisResult, 'minutaDecisao1VP' | 'checklistSecoes' | 'diagnosticoGeral'>,
  opcoes: { baseCustom?: EntradaBase[]; anteriores?: CitacaoPrecedente[] } = {},
): CitacaoPrecedente[] {
  return verificarPrecedentes(coletarTextos(r), opcoes);
}

/** Cria uma citação manual (ex.: precedente que o assessor quer acompanhar). */
export function criarCitacaoManual(tipo: Tipo, tribunal: Tribunal | null, numero: string, baseCustom: EntradaBase[] = []): CitacaoPrecedente {
  const base = montarBase(baseCustom);
  const num = numero.trim();
  return {
    id: idEstavel(tipo, tribunal, num),
    tipo,
    tribunal,
    numero: num,
    rotulo: rotulo(tipo, tribunal, num),
    ocorrencias: [],
    verificacao: verificarUma({ tipo, tribunal, numero: num, contexto: '' }, base),
    linkOficial: linkOficial(tipo, tribunal, num),
    manual: true,
    conferencia: { situacao: 'pendente' },
  };
}

export function resumoPrecedentes(c: CitacaoPrecedente[]) {
  const r = { total: c.length, confirmadas: 0, alertas: 0, aConferir: 0, conferidasPeloUsuario: 0 };
  for (const x of c) {
    if (x.conferencia.situacao === 'conferido') r.conferidasPeloUsuario++;
    const s = x.verificacao.status;
    if (s === 'confirmada') r.confirmadas++;
    else if (s === 'inexistente' || s === 'cancelada_ou_superada') r.alertas++;
    else r.aConferir++;
  }
  return r;
}
