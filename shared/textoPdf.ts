/**
 * Conversão do texto extraído de PDFs para Markdown enxuto (menos tokens).
 * A extração em si (pdf.js) fica no navegador; aqui há só a limpeza, que é testável.
 */

export interface ResultadoMarkdown {
  texto: string;
  paginas: number;
  caracteres: number;
  linhasRepetidasRemovidas: number;
}

/** Normaliza para comparar linhas repetidas: números viram "#", exceto datas (carimbos com datas diferentes não se confundem). */
const normalizaCabecalho = (l: string) =>
  l
    .toLowerCase()
    .replace(/(\d{2}\/\d{2}\/\d{4})|\d+/g, (_m, data: string | undefined) => data ?? '#')
    .replace(/\s+/g, ' ')
    .trim();

/** Estimativa grosseira: ~3,6 caracteres por token em português. */
export function estimarTokensTexto(chars: number): number {
  return Math.ceil(chars / 3.6);
}

/** Estimativa grosseira para PDF enviado como arquivo (varia por provedor: ~1.500–3.000 tokens/página). */
export function estimarTokensPdf(paginas: number): number {
  return paginas * 2000;
}

export function montarMarkdown(linhasPorPagina: string[][]): ResultadoMarkdown {
  const n = linhasPorPagina.length;
  const MARGEM = 3; // só as 3 primeiras e as 3 últimas linhas de cada página são candidatas a cabeçalho/rodapé
  const naMargem = (linhas: string[]) => {
    const idx = linhas.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
    return new Set([...idx.slice(0, MARGEM), ...idx.slice(-MARGEM)]);
  };
  // cabeçalho/rodapé: linha (com números normalizados) na margem de >= 50% das páginas (mín. 4 páginas)
  const contagem = new Map<string, number>();
  if (n >= 4) {
    for (const linhas of linhasPorPagina) {
      const m = naMargem(linhas);
      for (const k of new Set([...m].map((i) => normalizaCabecalho(linhas[i])).filter((x) => x.length > 3))) {
        contagem.set(k, (contagem.get(k) ?? 0) + 1);
      }
    }
  }
  const repetida = (l: string, naMg: boolean) => naMg && n >= 4 && (contagem.get(normalizaCabecalho(l)) ?? 0) >= Math.ceil(n * 0.5);

  let removidas = 0;
  const partes: string[] = [];
  const carimbos = new Map<string, string>(); // linha normalizada -> 1ª ocorrência (mostrada uma única vez no topo)
  linhasPorPagina.forEach((linhas, i) => {
    const margem = naMargem(linhas);
    const uteis = linhas
      .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
      .filter((l, k) => {
        if (!l) return true;
        if (repetida(l, margem.has(k))) {
          removidas++;
          const chave = normalizaCabecalho(l);
          if (!carimbos.has(chave)) carimbos.set(chave, l);
          return false;
        }
        return true;
      });
    let corpo = uteis.join('\n');
    corpo = corpo
      .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2') // hifenização de fim de linha
      .replace(/([^\n.:;!?»")\]])\n(?=\p{Ll})/gu, '$1 ') // quebra no meio de frase
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (corpo) partes.push(`[p. ${i + 1}]\n${corpo}`);
  });
  // o conteúdo do carimbo (protocolo, assinatura, número do recurso) é informação dos autos: fica uma vez só, no topo
  if (carimbos.size > 0) {
    partes.unshift(`[Cabeçalho/rodapé repetido em todas as páginas, mostrado uma vez]\n${[...carimbos.values()].join('\n')}`);
  }
  const texto = partes.join('\n\n');
  return { texto, paginas: n, caracteres: texto.length, linhasRepetidasRemovidas: removidas };
}

/** PDF escaneado (sem camada de texto): poucos caracteres por página. */
export function pareceEscaneado(r: Pick<ResultadoMarkdown, 'caracteres' | 'paginas'>): boolean {
  return r.paginas > 0 && r.caracteres / r.paginas < 150;
}
