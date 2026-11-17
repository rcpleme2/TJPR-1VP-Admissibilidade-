import type { Provedor } from './schema';

/**
 * Três níveis de modelo por fornecedor: básico (rápido e barato), intermediário (equilíbrio, o padrão) e complexo
 * (mais capaz, mais lento e caro). O servidor escolhe, na lista de modelos que a chave do usuário pode usar, o mais
 * recente de cada família; se a lista não vier, usa o nome padrão abaixo (ajustável por variável de ambiente).
 */
export const NIVEIS = ['basico', 'intermediario', 'complexo'] as const;
export type Nivel = (typeof NIVEIS)[number];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  complexo: 'Complexo',
};

export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  basico: 'Mais rápido e barato. Para casos simples, com poucas peças e uma única questão.',
  intermediario: 'Equilíbrio entre qualidade, tempo e custo. Recomendado para a maioria dos exames.',
  complexo: 'O mais capaz, mais lento e caro. Para vários capítulos, muitas peças ou teses difíceis.',
};

/** Família de cada nível, como o fornecedor a chama. */
export const FAMILIA_NIVEL: Record<Provedor, Record<Nivel, string>> = {
  gemini: { basico: 'Flash-Lite', intermediario: 'Flash', complexo: 'Pro' },
  claude: { basico: 'Haiku', intermediario: 'Sonnet', complexo: 'Opus' },
  gpt: { basico: 'nano', intermediario: 'mini', complexo: 'principal' },
};

/** Nome usado quando a lista de modelos do fornecedor não está disponível. */
export const MODELOS_RESERVA: Record<Provedor, Record<Nivel, string>> = {
  gemini: { basico: 'gemini-3.5-flash-lite', intermediario: 'gemini-3.8-flash', complexo: 'gemini-3.1-pro-preview' },
  claude: { basico: 'claude-haiku-5-5', intermediario: 'claude-sonnet-5-5', complexo: 'claude-opus-5-5' },
  gpt: { basico: 'gpt-5.4-nano', intermediario: 'gpt-5.4-mini', complexo: 'gpt-5.5' },
};

/** Valor gravado/enviado para um nível ("nivel:complexo"). */
export const valorNivel = (n: Nivel) => `nivel:${n}`;
export const nivelDoValor = (v: string | undefined): Nivel | null => {
  const m = v?.match(/^nivel:(basico|intermediario|complexo)$/);
  return m ? (m[1] as Nivel) : null;
};

/** Números da versão no nome do modelo, para achar o mais recente ("gemini-3.8-flash" → [3, 8]). */
function versao(id: string): number[] {
  const m = id.match(/(\d+(?:[.-]\d+)*)/);
  return m ? m[1].split(/[.-]/).map(Number).filter((n) => n < 1000) : [];
}
const maisNovo = (a: string, b: string) => {
  const va = versao(a);
  const vb = versao(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? -1) - (va[i] ?? -1);
    if (d) return d;
  }
  return a.length - b.length; // sem data no fim vem antes do instantâneo datado
};

const instavel = /preview|exp|experimental|latest|tts|audio|image|live|vision|embed|search|realtime|transcribe|codex|chat|instruct|thinking|computer|deep-research|oss|moderation/i;

/** Regra de cada nível: quais nomes pertencem a ele. */
const REGRAS: Record<Provedor, Record<Nivel, (id: string) => boolean>> = {
  gemini: {
    basico: (id) => /^gemini-[\d.]+-flash-lite$/.test(id),
    intermediario: (id) => /^gemini-[\d.]+-flash$/.test(id),
    complexo: (id) => /^gemini-[\d.]+-pro$/.test(id),
  },
  claude: {
    basico: (id) => /^claude-haiku-\d/.test(id),
    intermediario: (id) => /^claude-sonnet-\d/.test(id),
    complexo: (id) => /^claude-opus-\d/.test(id),
  },
  gpt: {
    basico: (id) => /^gpt-[\d.]+-nano$/.test(id),
    intermediario: (id) => /^gpt-[\d.]+-mini$/.test(id),
    complexo: (id) => /^gpt-[\d.]+$/.test(id),
  },
};

/** O modelo mais recente do nível entre os disponíveis para a chave; null se nenhum servir. */
export function escolherNivel(provedor: Provedor, nivel: Nivel, disponiveis: string[]): string | null {
  const candidatos = disponiveis.filter((id) => REGRAS[provedor][nivel](id) && !(provedor !== 'claude' && instavel.test(id)));
  // O Gemini Pro novo costuma passar meses em prévia enquanto o estável antigo é aposentado: vale a versão mais nova,
  // e a estável só ganha em empate de versão.
  if (provedor === 'gemini' && nivel === 'complexo') {
    candidatos.push(...disponiveis.filter((id) => /^gemini-[\d.]+-pro-preview(-[\d-]+)?$/.test(id)));
  }
  return candidatos.sort(maisNovo)[0] ?? null;
}
