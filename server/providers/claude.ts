import { postJson } from './http';
import { ProviderError, type EntradaProvedor, type Provedorlike } from './types';

const TOOL = 'registrar_analise';

export const claude: Provedorlike = {
  id: 'claude',
  async executar({ apiKey, model, system, partes, jsonSchema, signal }: EntradaProvedor) {
    const content = partes.map((p) =>
      p.kind === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.base64 } },
    );
    const data = await postJson(
      'claude',
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content }],
        tools: [
          {
            name: TOOL,
            description: 'Registra a análise de admissibilidade estruturada conforme o schema.',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: TOOL },
      },
      signal,
    );
    const bloco = (data?.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
    if (!bloco?.input) {
      throw new ProviderError(`Claude: resposta sem a estrutura esperada (${data?.stop_reason ?? 'desconhecido'}).`, 502, false);
    }
    if (data.stop_reason === 'max_tokens') {
      throw new ProviderError('Claude: resposta truncada por limite de tokens. Reduza o volume de peças.', 502, false);
    }
    return JSON.stringify(bloco.input);
  },
};
