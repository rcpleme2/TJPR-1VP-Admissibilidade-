import { postJson } from './http';
import { ProviderError, type EntradaProvedor, type Provedorlike } from './types';

export const gpt: Provedorlike = {
  id: 'gpt',
  async executar({ apiKey, model, system, partes, jsonSchema, signal }: EntradaProvedor) {
    const content = partes.map((p) =>
      p.kind === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'file', file: { filename: p.name, file_data: `data:application/pdf;base64,${p.base64}` } },
    );
    const data = await postJson(
      'gpt',
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'analise_admissibilidade', strict: false, schema: jsonSchema } },
      },
      signal,
    );
    const choice = data?.choices?.[0];
    if (choice?.message?.refusal) throw new ProviderError('GPT: o modelo recusou a solicitação.', 502, false);
    if (choice?.finish_reason === 'length') throw new ProviderError('GPT: resposta truncada por limite de tokens.', 502, false);
    const texto = choice?.message?.content;
    if (!texto) throw new ProviderError('GPT: resposta vazia.', 502, false);
    return texto;
  },
};
