import type { Provedor } from '../shared/schema';

export const PORT = Number(process.env.PORT) || 8080;
export const IS_PROD = process.env.NODE_ENV === 'production';

/** Teto de requisições de análise por IP/janela. */
export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 15;
export const RATE_LIMIT_WINDOW_MIN = Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15;

/** Timeout de uma chamada ao provedor (ms). Cloud Run: ajuste --timeout para ser maior que isto. */
export const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS) || 240_000;

export const MODELOS_PADRAO: Record<Provedor, string> = {
  gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  claude: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  gpt: process.env.OPENAI_MODEL || 'gpt-4.1',
};

const ENV_KEYS: Record<Provedor, string | undefined> = {
  gemini: process.env.GEMINI_API_KEY,
  claude: process.env.ANTHROPIC_API_KEY,
  gpt: process.env.OPENAI_API_KEY,
};

/** Chaves de API guardadas no servidor (usadas apenas por usuários autenticados). */
export function chaveDoServidor(p: Provedor): string | undefined {
  return ENV_KEYS[p] || undefined;
}

export function provedoresComChaveNoServidor(): Provedor[] {
  return (['gemini', 'claude', 'gpt'] as const).filter((p) => Boolean(chaveDoServidor(p)));
}
