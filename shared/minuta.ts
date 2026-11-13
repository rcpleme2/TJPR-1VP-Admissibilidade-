/** Remove do cabeçalho da minuta as linhas de timbre que a página já imprime (tribunal, vice-presidência). */
export function cabecalhoSemTimbre(cabecalho: string): string {
  const linhas = (cabecalho || '').split('\n');
  let i = 0;
  while (i < linhas.length && (!linhas[i].trim() || /^(poder judici[aá]rio|tribunal de justi[cç]a|1[ªa°o]?\s*vice-?presid[eê]ncia)/i.test(linhas[i].trim()))) i++;
  return linhas.slice(i).join('\n');
}
