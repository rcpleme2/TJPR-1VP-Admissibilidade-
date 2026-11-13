import type { Provedor } from '../../shared/schema';
import { redigirSegredos } from '../sanitize';
import { ProviderError } from './types';

export interface ModeloDisponivel {
  id: string;
  nome: string;
}

const NOMES: Record<Provedor, string> = { gemini: 'Gemini', claude: 'Claude', gpt: 'GPT' };

async function getJson(provedor: Provedor, url: string, headers: Record<string, string>): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ProviderError(`${NOMES[provedor]}: não foi possível consultar a lista de modelos.`, 502, false);
  }
  if (res.ok) return res.json();
  const corpo = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) throw new ProviderError(`${NOMES[provedor]}: chave de API inválida ou sem permissão.`, res.status, false);
  if (res.status === 429) throw new ProviderError(`${NOMES[provedor]}: limite de uso excedido. Tente em alguns minutos.`, 429, false);
  throw new ProviderError(`${NOMES[provedor]}: falha ao listar modelos (HTTP ${res.status}). ${redigirSegredos(corpo).slice(0, 120)}`.trim(), 502, false);
}

/** Modelos de texto que a chave pode usar, já filtrados para os que servem à análise. */
export async function listarModelos(provedor: Provedor, apiKey: string): Promise<ModeloDisponivel[]> {
  if (provedor === 'gemini') {
    const j = await getJson('gemini', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': apiKey });
    return (j.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), nome: m.displayName || String(m.name) }))
      .filter((m: ModeloDisponivel) => /^gemini/.test(m.id) && !/tts|image|embedding|live|audio|vision/.test(m.id))
      .sort((a: ModeloDisponivel, b: ModeloDisponivel) => b.id.localeCompare(a.id, 'en', { numeric: true }));
  }
  if (provedor === 'claude') {
    const j = await getJson('claude', 'https://api.anthropic.com/v1/models?limit=1000', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
    // A API já devolve do mais recente para o mais antigo.
    return (j.data ?? []).map((m: any) => ({ id: String(m.id), nome: m.display_name || String(m.id) }));
  }
  const j = await getJson('gpt', 'https://api.openai.com/v1/models', { authorization: `Bearer ${apiKey}` });
  return (j.data ?? [])
    .map((m: any) => String(m.id))
    .filter((id: string) => /^(gpt-|o\d|chatgpt)/.test(id) && !/audio|realtime|transcribe|tts|image|search|instruct|embedding|moderation|codex|preview/.test(id))
    .sort((a: string, b: string) => b.localeCompare(a, 'en', { numeric: true }))
    .map((id: string) => ({ id, nome: id }));
}
