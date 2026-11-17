/** Classificação automática das peças anexadas: pelo nome do arquivo e, no acórdão, pelo conteúdo. */

export type PapelArquivo = 'acordao' | 'acordao_embargos' | 'recurso_especial' | 'recurso_extraordinario' | 'guia_preparo' | 'outro';

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Papel do arquivo a partir do nome (palavras inteiras, para evitar falsos positivos como "resposta" → REsp). */
export function detectarPapel(nome: string, padrao: PapelArquivo): PapelArquivo {
  const tokens = normalizar(nome)
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tem = (...ps: string[]) => ps.some((p) => tokens.includes(p));
  const colado = tokens.join('');
  // preparo, custas, guia ou pagamento em qualquer parte do nome (inclusive colado: "GuiaCustas", "comprovantepagamento")
  if (/preparo|custas|guia|pagamento/.test(colado) || tem('gru', 'darf', 'comprovante', 'recolhimento', 'porte')) return 'guia_preparo';
  if (/recursoextraordinario/.test(colado)) return 'recurso_extraordinario';
  if (/recursoespecial/.test(colado)) return 'recurso_especial';
  if (tem('acordao', 'sentenca')) return tem('embargos', 'edcl', 'ed') ? 'acordao_embargos' : 'acordao';
  if (tem('embargos', 'edcl')) return 'acordao_embargos';
  if (tem('extraordinario', 're')) return 'recurso_extraordinario';
  if (tem('especial', 'resp')) return 'recurso_especial';
  return padrao;
}

// "embargos" que não são de declaração (à execução, do devedor, de terceiro, monitórios) não contam
const EMBARGOS = String.raw`embargos(?!\s+(?:a|ao)\s+(?:execucao|monitoria)|\s+do\s+devedor|\s+de\s+terceiro|\s+monitorios|\s+infringentes|\s+de\s+divergencia)`;
// Só o dispositivo do próprio julgamento: 1ª pessoa ("acolho", "rejeito") ou do colegiado ("acordam em rejeitar",
// "acolheram"); narrativas como "a sentença rejeitou os embargos" não contam.
const VERBO = String.raw`(?:acolho|rejeito|acolhem|rejeitam|acolheram|rejeitaram|acolher|rejeitar|acolhe-se|rejeita-se)`;
const PADROES_EMBARGOS = [
  // "acolho (parcialmente) os embargos", "rejeito os embargos de declaração", "acolheram em parte os embargos"
  new RegExp(String.raw`\b${VERBO}(?:\s+(?:parcialmente|em\s+parte|integralmente|os|aos|dos|presentes|estes|com|sem|efeitos|infringentes|modificativos|,))*\s+${EMBARGOS}`),
  // ementa: "Embargos de declaração (conhecidos e) rejeitados." / "EMBARGOS ACOLHIDOS EM PARTE"
  new RegExp(String.raw`(?:^|[.;:]\s*)embargos(?:\s+de\s+declaracao)?\s+(?:conhecidos\s+e\s+)?(?:parcialmente\s+)?(?:acolhidos|rejeitados)\b`),
];

/** O texto do acórdão decide embargos de declaração (acolho, rejeito, acolho parcialmente os embargos)? */
export function pareceAcordaoEmbargos(texto: string): boolean {
  const t = normalizar(texto).replace(/\s+/g, ' ');
  return PADROES_EMBARGOS.some((re) => re.test(t));
}

/** Papel final: o do nome, corrigido pelo conteúdo quando um "acórdão" decide embargos de declaração. */
export function papelPeloConteudo(papel: PapelArquivo, texto: string | undefined): PapelArquivo {
  return papel === 'acordao' && texto && pareceAcordaoEmbargos(texto) ? 'acordao_embargos' : papel;
}
