/**
 * Base de temas do STJ (dados abertos: temas.csv). Repetitivos ("Tema") e de relevância (linhas sem tipo).
 * Serve para: conferir número, situação e ordem de suspensão dos temas indicados pela IA; achar temas cuja questão
 * se parece com a do recurso; e mostrar a questão submetida e a tese firmada.
 */

export type FaseTemaStj = 'pendente' | 'julgado' | 'cancelado' | 'outro';
export type SuspensaoTemaStj = 'determinada' | 'nao_determinada' | 'nao_informada';

export interface TemaStj {
  especie: 'repetitivo' | 'relevancia';
  numero: string;
  /** Situação como publicada pelo STJ (ex.: "Afetado", "Trânsito em Julgado"). */
  situacao: string;
  fase: FaseTemaStj;
  suspensao: SuspensaoTemaStj;
  /** Texto oficial sobre a suspensão (informações complementares). */
  textoSuspensao: string;
  questao: string;
  tese: string;
  orgao: string;
  afetacao: string;
  julgamento: string;
  assuntos: string;
  legislacao: string;
}

// --- CSV (RFC 4180: aspas, vírgulas e quebras de linha dentro do campo) -------------------------------

export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

const limpo = (s: string | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function faseDaSituacao(situacao: string): FaseTemaStj {
  const s = situacao.toLowerCase();
  if (/cancel/.test(s)) return 'cancelado';
  if (/afetad|em julgamento|pendente$|^pendente|relev[âa]ncia reconhecida$|em afeta|sobrestad|admitido/.test(s) && !/re pendente/.test(s)) return 'pendente';
  if (/tr[âa]nsito|ac[óo]rd[ãa]o publicado|m[ée]rito julgado|revisad|reafirma|tese negativa/.test(s)) return 'julgado';
  return 'outro';
}

export function suspensaoDoTexto(info: string): SuspensaoTemaStj {
  const s = limpo(info).toLowerCase();
  if (/h[áa] determina[çc][ãa]o de\s+suspens|suspens[ãa]o deferida|determinou a suspens/.test(s)) return 'determinada';
  if (/sem a?\s*determina[çc][ãa]o de\s*suspens|n[ãa]o aplica[çc][ãa]o do disposto na parte final do § ?1|suspens[ãa]o indeferida|n[ãa]o houve determina[çc][ãa]o de suspens|finalizada determina[çc][ãa]o de suspens/.test(s))
    return 'nao_determinada';
  return 'nao_informada';
}

/** Converte o temas.csv do STJ na lista de temas (repetitivos e de relevância), sem repetições. */
export function lerTemasStj(csv: string): TemaStj[] {
  const [cab, ...linhas] = lerCsv(csv);
  if (!cab) return [];
  const col = (nome: string) => cab.findIndex((c) => c.trim() === nome);
  const ix = {
    tipo: col('tipoPrecedente'),
    numero: col('numeroPrecedente'),
    afetacao: col('dataPrimeiraAfetacao'),
    julgamento: col('dataJulgamento'),
    situacao: col('situacao'),
    info: col('informacoesComplementares'),
    questao: col('questaoSubmetidaAJulgamento'),
    tese: col('teseFirmada'),
    legislacao: col('referenciaLegislativa'),
    orgao: col('orgaoJulgador'),
    assuntos: col('Assuntos'),
  };
  if (ix.numero < 0 || ix.situacao < 0) throw new Error('Formato inesperado do temas.csv do STJ.');
  const vistos = new Set<string>();
  const out: TemaStj[] = [];
  for (const l of linhas) {
    const tipo = limpo(l[ix.tipo]);
    if (tipo !== 'Tema' && tipo !== '') continue; // controvérsias, PUIL, IAC e SIRDR não vinculam aqui
    const especie = tipo === 'Tema' ? 'repetitivo' : 'relevancia';
    const numero = limpo(l[ix.numero]).replace(/\D/g, '');
    if (!numero || vistos.has(`${especie}-${numero}`)) continue;
    vistos.add(`${especie}-${numero}`);
    const situacao = limpo(l[ix.situacao]);
    const info = limpo(l[ix.info]);
    out.push({
      especie,
      numero,
      situacao,
      fase: faseDaSituacao(situacao),
      suspensao: suspensaoDoTexto(info),
      textoSuspensao: info.slice(0, 600),
      questao: limpo(l[ix.questao]),
      tese: limpo(l[ix.tese]),
      orgao: limpo(l[ix.orgao]),
      afetacao: limpo(l[ix.afetacao]),
      julgamento: limpo(l[ix.julgamento]),
      assuntos: limpo(l[ix.assuntos]),
      legislacao: limpo(l[ix.legislacao]).slice(0, 600),
    });
  }
  return out;
}

// --- Busca textual (BM25) ------------------------------------------------------------------------

const PARADAS = new Set(
  (
    'a o e as os de da do das dos em no na nos nas um uma uns umas por para pelo pela pelos pelas com sem sob sobre que se ao aos à às ' +
    'ou como mais menos já não nao sua seu suas seus sua ser são sao foi é e ter tem há ha entre quando onde qual quais este esta esse essa isso isto ' +
    'art arts lei leis inciso alinea paragrafo caput codigo civil processo processual recurso recursos especial acordao tribunal stj stf ' +
    'parte partes autos fls fl pag p mov seq possibilidade definir discute discutese questao saber se acerca respeito hipotese termos forma caso casos'
  ).split(/\s+/),
);

const dobrar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Palavras significativas, reduzidas a um radical simples (plural e gênero). */
export function termos(texto: string): string[] {
  return dobrar(texto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !PARADAS.has(w) && !/^\d{1,2}$/.test(w))
    .map((w) => (w.length > 5 ? w.replace(/(oes|aes|ais|eis|is|es|s|a|o)$/, '') : w));
}

/** Termos e pares de termos vizinhos ("tarifa cadastr"): expressões iguais pesam mais que palavras soltas. */
export function termosComPares(texto: string): string[] {
  const ts = termos(texto);
  const pares = ts.slice(1).map((w, i) => `${ts[i]}_${w}`);
  return [...ts, ...pares];
}

export interface IndiceTemas {
  temas: TemaStj[];
  df: Map<string, number>;
  docs: Array<{ tf: Map<string, number>; len: number }>;
  media: number;
}

export function indexar(temas: TemaStj[]): IndiceTemas {
  const df = new Map<string, number>();
  const docs = temas.map((t) => {
    // a questão pesa mais que a tese; assuntos e legislação ajudam a desempatar
    const q = termosComPares(t.questao);
    const ts = [...q, ...q, ...termosComPares(t.tese), ...termos(t.assuntos), ...termos(t.legislacao)];
    const tf = new Map<string, number>();
    for (const w of ts) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    return { tf, len: ts.length };
  });
  const media = docs.reduce((n, d) => n + d.len, 0) / Math.max(1, docs.length);
  return { temas, df, docs, media };
}

export interface TemaEncontrado extends TemaStj {
  pontuacao: number;
}

/**
 * Temas cuja questão mais se parece com o texto (BM25). O texto pode ser longo (as razões do recurso): cada termo
 * conta pelo log da frequência, para que palavras repetidas à exaustão não dominem.
 */
export function buscarTemas(indice: IndiceTemas, texto: string, o: { limite?: number; fases?: FaseTemaStj[]; minimo?: number } = {}): TemaEncontrado[] {
  const { limite = 10, fases, minimo = 0 } = o;
  const consulta = new Map<string, number>();
  for (const w of termosComPares(texto)) consulta.set(w, (consulta.get(w) ?? 0) + 1);
  const N = indice.docs.length;
  const k1 = 1.2;
  const b = 0.75;
  const pont = indice.docs.map((d, i) => {
    if (fases && !fases.includes(indice.temas[i].fase)) return 0;
    let s = 0;
    for (const [w, qtf] of consulta) {
      const f = d.tf.get(w);
      if (!f) continue;
      const n = indice.df.get(w) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / indice.media))) * (1 + Math.log(qtf));
    }
    return s;
  });
  return pont
    .map((p, i) => ({ p, i }))
    .filter((x) => x.p > minimo)
    .sort((a, b) => b.p - a.p)
    .slice(0, limite)
    .map(({ p, i }) => ({ ...indice.temas[i], pontuacao: Math.round(p * 10) / 10 }));
}

export function temaPorNumero(indice: IndiceTemas, numero: string, especie?: TemaStj['especie']): TemaStj | undefined {
  const n = numero.replace(/\D/g, '');
  if (!n) return undefined;
  return indice.temas.find((t) => t.numero === n && (!especie || t.especie === especie)) ?? indice.temas.find((t) => t.numero === n);
}

/** Números de temas do STJ citados no texto ("Tema 466/STJ", "Tema Repetitivo n. 1.076"). */
export function temasCitados(texto: string): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(/\btema\s+(?:repetitivo\s+)?(?:de\s+relev[âa]ncia\s+)?(?:n\.?[º°o]?\s*|n[úu]mero\s+)?(\d{1,2}\.?\d{3}|\d{1,4})\b(?!\s*(?:\/|do|da)\s*(?:stf|supremo|rg|repercuss))/gi)) {
    out.add(m[1].replace(/\D/g, ''));
  }
  return [...out];
}

export const ROTULO_FASE_STJ: Record<FaseTemaStj, string> = {
  pendente: 'Afetado, mérito pendente',
  julgado: 'Mérito julgado',
  cancelado: 'Cancelado',
  outro: 'Situação a conferir',
};
