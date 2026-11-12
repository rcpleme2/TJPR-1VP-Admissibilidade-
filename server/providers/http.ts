import { PROVIDER_TIMEOUT_MS } from '../config';
import { redigirSegredos } from '../sanitize';
import { ProviderError } from './types';

const NOMES = { gemini: 'Gemini', claude: 'Claude', gpt: 'GPT' } as const;

function mensagemAmigavel(provedor: keyof typeof NOMES, status: number, corpo: string): string {
  const n = NOMES[provedor];
  if (status === 401 || status === 403) return `${n}: chave de API inválida, sem permissão ou sem acesso ao modelo escolhido.`;
  if (status === 404) return `${n}: modelo não encontrado. Confira o nome do modelo nas configurações do motor.`;
  if (status === 413) return `${n}: documentos grandes demais para este provedor.`;
  if (status === 429) return `${n}: limite de uso/quota excedido. Aguarde alguns minutos ou use outra chave/motor.`;
  if (status === 400) return `${n}: requisição recusada (${redigirSegredos(corpo).slice(0, 200)}).`;
  if (status >= 500) return `${n}: serviço indisponível no momento (HTTP ${status}).`;
  return `${n}: erro inesperado (HTTP ${status}).`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST JSON com timeout, retry exponencial (429/5xx) e erros sem vazamento de segredos. */
export async function postJson(
  provedor: keyof typeof NOMES,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
  tentativas = 3,
): Promise<any> {
  let ultimo: ProviderError | null = null;
  for (let i = 0; i < tentativas; i++) {
    const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
    const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: sig });
      if (res.ok) return await res.json();
      const texto = await res.text().catch(() => '');
      const retry = res.status === 429 || res.status === 503 || res.status === 529 || res.status === 500;
      ultimo = new ProviderError(mensagemAmigavel(provedor, res.status, texto), res.status, retry);
      if (!retry) throw ultimo;
    } catch (err) {
      if (err instanceof ProviderError) {
        if (!err.retryable) throw err;
        ultimo = err;
      } else if (signal?.aborted) {
        throw new ProviderError('Análise cancelada pelo usuário.', 499, false);
      } else if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError') {
        ultimo = new ProviderError(`${NOMES[provedor]}: tempo limite excedido.`, 504, false);
        throw ultimo;
      } else {
        ultimo = new ProviderError(`${NOMES[provedor]}: falha de rede ao contatar o provedor.`, 502, true);
      }
    }
    if (i < tentativas - 1) await sleep(1000 * 2 ** i + Math.random() * 300);
  }
  throw ultimo ?? new ProviderError(`${NOMES[provedor]}: falha desconhecida.`, 502, false);
}
