import crypto from 'node:crypto';
import type { Provedor } from '../shared/schema';

export const PORT = Number(process.env.PORT) || 8080;
export const IS_PROD = process.env.NODE_ENV === 'production';

/** Se definido, todas as rotas /api (exceto health/config) exigem o cabeçalho x-access-token. */
export const ACCESS_TOKEN = process.env.APP_ACCESS_TOKEN || '';

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

/**
 * Chaves guardadas no servidor só podem ser usadas se houver APP_ACCESS_TOKEN;
 * do contrário qualquer visitante gastaria a cota do órgão.
 */
export function chaveDoServidor(p: Provedor): string | undefined {
  return ACCESS_TOKEN ? ENV_KEYS[p] || undefined : undefined;
}

export function provedoresComChaveNoServidor(): Provedor[] {
  return (['gemini', 'claude', 'gpt'] as const).filter((p) => Boolean(chaveDoServidor(p)));
}

export function tokenConfere(recebido: string | undefined): boolean {
  if (!ACCESS_TOKEN) return true;
  if (!recebido) return false;
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(ACCESS_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}
