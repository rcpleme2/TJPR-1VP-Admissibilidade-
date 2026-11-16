/**
 * Movimentações do Projudi lidas do texto dos PDFs.
 *
 * Cada página de um documento juntado traz um carimbo como:
 *   PROJUDI - Recurso: 0010045-96.2026.8.16.0045 - Ref. mov. 88.1 - Assinado digitalmente por ...
 *   25/07/2026: INTERPOSIÇÃO DE RECURSO. Arq: Petição
 * A referência agrupa as páginas por movimento; a segunda linha dá a data e a descrição do ato.
 * Listagens de movimentação ("88  25/07/2026 15:32  INTERPOSIÇÃO DE RECURSO ...") também são lidas.
 */

export interface Movimento {
  /** Número do movimento, como aparece no Projudi (ex.: "88.1" ou "88"). */
  ref: string;
  /** Data do ato, dd/mm/aaaa. */
  data?: string;
  /** Descrição do movimento (ex.: "INTERPOSIÇÃO DE RECURSO"). */
  descricao?: string;
  /** Nome do arquivo no Projudi (ex.: "Petição", "Acórdão"). */
  arquivo?: string;
  /** PDF de onde o movimento foi lido. */
  origem: string;
  paginas: number[];
  /** Trecho do conteúdo, com teto de tamanho. */
  texto: string;
}

export const LIMITE_TEXTO_MOVIMENTO = 2500;
export const LIMITE_TEXTO_MOVIMENTOS = 240_000;
export const LIMITE_MOVIMENTOS = 250;

export const RE_REF_PROJUDI = /PROJUDI\s*-\s*(?:Recurso|Processo)\s*:\s*[\d.\-]{15,30}\s*-\s*Ref\.\s*mov\.\s*(\d+(?:\.\d+)?)/i;
/** "dd/mm/aaaa: DESCRIÇÃO. Arq: Nome" (segunda linha do carimbo). */
export const RE_CARIMBO = /(\d{2}\/\d{2}\/\d{4})\s*:\s*([^\n]{3,160}?)\s*\.\s*Arq\s*:?\s*([^\n]{0,120})/i;
/** Linha de uma listagem de movimentação: número, data (e hora) e descrição em maiúsculas. */
const RE_LISTA = /^\s*(?:Seq\.?\s*)?(\d{1,4}(?:\.\d{1,3})?)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(?:às\s+)?\d{2}:\d{2}(?::\d{2})?)?\s*[-–]?\s*(.{4,200})$/;
const ASSINATURA = /^(Documento assinado digitalmente|Validação deste em|PROJUDI\s*-)/i;

const maiusculas = (s: string) => {
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letras.length >= 4 && letras.replace(/[^A-ZÀ-Þ]/g, '').length / letras.length > 0.7;
};
const limpa = (s: string) => s.replace(/\s+/g, ' ').trim();

function resumir(linhas: string[]): string {
  const t = linhas
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
    .replace(/([^\n.:;!?»")\]])\n(?=\p{Ll})/gu, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t.length > LIMITE_TEXTO_MOVIMENTO ? `${t.slice(0, LIMITE_TEXTO_MOVIMENTO).replace(/\s+\S*$/, '')}…` : t;
}

/** Lê os movimentos de um PDF a partir do texto de cada página. */
export function extrairMovimentos(paginas: string[], origem: string): Movimento[] {
  const porRef = new Map<string, Movimento & { linhas: string[] }>();
  const lista: Movimento[] = [];

  paginas.forEach((txt, i) => {
    const linhas = txt.split('\n');
    let ref: string | undefined;
    let carimbo: RegExpMatchArray | null = null;
    for (const l of linhas) {
      ref ??= l.match(RE_REF_PROJUDI)?.[1];
      carimbo ??= l.match(RE_CARIMBO);
    }
    if (ref) {
      const corpo = linhas.filter((l) => !ASSINATURA.test(l.trim()) && !RE_CARIMBO.test(l));
      const m = porRef.get(ref);
      if (m) {
        m.paginas.push(i + 1);
        m.linhas.push(...corpo);
      } else {
        porRef.set(ref, {
          ref,
          data: carimbo?.[1],
          descricao: carimbo ? limpa(carimbo[2]) : undefined,
          arquivo: carimbo?.[3] ? limpa(carimbo[3]) || undefined : undefined,
          origem,
          paginas: [i + 1],
          texto: '',
          linhas: [...corpo],
        });
      }
      return;
    }
    // páginas sem carimbo: procura uma listagem de movimentação
    for (const l of linhas) {
      const m = l.match(RE_LISTA);
      if (m && maiusculas(m[3]!.split(/\s{2,}/)[0]!)) {
        lista.push({ ref: m[1]!, data: m[2], descricao: limpa(m[3]!.split(/\s{2,}/)[0]!), origem, paginas: [i + 1], texto: '' });
      }
    }
  });

  const comTexto = [...porRef.values()].map(({ linhas, ...m }) => ({ ...m, texto: resumir(linhas) }));
  // um item da listagem que já tem o documento correspondente (mesmo número) fica só com os dados que faltarem
  for (const item of lista) {
    const doc = comTexto.find((m) => m.ref === item.ref || m.ref.startsWith(`${item.ref}.`));
    if (doc) {
      doc.descricao ??= item.descricao;
      doc.data ??= item.data;
    } else if (!comTexto.some((m) => m.ref === item.ref)) {
      comTexto.push({ ...item, texto: item.descricao ?? '' });
    }
  }
  return comTexto;
}

const chaveRef = (r: string) => r.split('.').map((n) => n.padStart(5, '0')).join('.');

/** Junta os movimentos de vários PDFs, sem repetição, em ordem, respeitando os tetos de tamanho. */
export function unirMovimentos(listas: Movimento[][]): Movimento[] {
  const mapa = new Map<string, Movimento>();
  for (const m of listas.flat()) {
    const atual = mapa.get(m.ref);
    if (!atual || m.texto.length > atual.texto.length) mapa.set(m.ref, { ...atual, ...m, data: m.data ?? atual?.data, descricao: m.descricao ?? atual?.descricao });
  }
  const ordenados = [...mapa.values()].sort((a, b) => chaveRef(a.ref).localeCompare(chaveRef(b.ref)));
  let total = 0;
  const out: Movimento[] = [];
  for (const m of ordenados.slice(0, LIMITE_MOVIMENTOS)) {
    const resto = LIMITE_TEXTO_MOVIMENTOS - total;
    if (resto <= 0) out.push({ ...m, texto: '' });
    else {
      const texto = m.texto.length > resto ? `${m.texto.slice(0, resto)}…` : m.texto;
      total += texto.length;
      out.push({ ...m, texto });
    }
  }
  return out;
}

/** Encontra o movimento citado ("88.1"; "88" casa com 88 ou com o primeiro 88.x). */
export function acharMovimento(movimentos: Movimento[], ref: string): Movimento | undefined {
  return movimentos.find((m) => m.ref === ref) ?? movimentos.find((m) => m.ref.startsWith(`${ref}.`)) ?? (ref.includes('.') ? movimentos.find((m) => m.ref === ref.split('.')[0]) : undefined);
}

/** Referências a movimentos no texto: "mov. 88.1", "seq. 1.1", "movimento 15", "evento 12". */
export const RE_CITACAO_MOV = /\b(mov(?:imento)?s?\.?|seq(?:uencial)?\.?|evento)\s*(?:n[º°.o]?\s*)?(\d{1,4}(?:\.\d{1,3})?)/gi;

const INTERPOSICAO = /INTERPOSI[ÇC][ÃA]O\s+DE\s+RECURSO/i;

export type PapelRecurso = 'recurso_especial' | 'recurso_extraordinario';

/**
 * Atos de "INTERPOSIÇÃO DE RECURSO" na movimentação: é a data a considerar como protocolo.
 * O tipo do recurso vem da descrição ou, se genérica, do início do conteúdo da petição.
 */
export function interposicoes(movimentos: Movimento[]): Array<{ papel: PapelRecurso | null; mov: Movimento }> {
  return movimentos
    .filter((m) => m.data && INTERPOSICAO.test(m.descricao ?? ''))
    .map((mov) => {
      const alvo = `${mov.descricao ?? ''} ${mov.texto.slice(0, 900)}`;
      const resp = /RECURSO\s+ESPECIAL/i.test(alvo);
      const re = /RECURSO\s+EXTRAORDIN[ÁA]RIO/i.test(alvo);
      return { papel: resp && !re ? 'recurso_especial' : re && !resp ? 'recurso_extraordinario' : null, mov };
    });
}
