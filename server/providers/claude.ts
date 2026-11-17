import { postJson } from './http';
import { ProviderError, type EntradaProvedor, type Provedorlike } from './types';

/**
 * Ajusta o JSON Schema às restrições da saída estruturada da Anthropic: todo objeto com additionalProperties: false
 * e sem limites numéricos, de tamanho ou padrões (a validação completa continua no servidor, pelo schema zod).
 */
export function esquemaParaClaude(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(esquemaParaClaude);
  if (!no || typeof no !== 'object') return no;
  const fora = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'pattern', 'default', '$schema']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(no as Record<string, unknown>)) {
    if (fora.has(k)) continue;
    out[k] = k === 'properties' && v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([p, s]) => [p, esquemaParaClaude(s)])) : esquemaParaClaude(v);
  }
  if (out.type === 'object' || out.properties) out.additionalProperties = false;
  return out;
}

export const claude: Provedorlike = {
  id: 'claude',
  async executar({ apiKey, model, system, partes, jsonSchema, signal }: EntradaProvedor) {
    const content = partes.map((p) =>
      p.kind === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } },
    );
    // Saída estruturada (output_config.format): os modelos atuais (Opus 5.5, Sonnet 5.5) recusam o uso forçado de
    // ferramenta (tool_choice "tool"), que era o meio usado antes para obter o JSON.
    const data = await postJson(
      'claude',
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: 32000,
        system,
        messages: [{ role: 'user', content }],
        output_config: { format: { type: 'json_schema', schema: esquemaParaClaude(jsonSchema) } },
      },
      signal,
    );
    if (data?.stop_reason === 'refusal') {
      throw new ProviderError('Claude: o modelo recusou a solicitação. Tente outro nível ou outro motor.', 502, false);
    }
    if (data?.stop_reason === 'max_tokens') {
      throw new ProviderError('Claude: resposta truncada por limite de tokens. Reduza o volume de peças.', 502, false);
    }
    const texto = (data?.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('');
    if (!texto.trim()) throw new ProviderError(`Claude: resposta sem conteúdo (${data?.stop_reason ?? 'desconhecido'}).`, 502, false);
    return texto;
  },
};
