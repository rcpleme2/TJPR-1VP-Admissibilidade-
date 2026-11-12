import { postJson } from './http';
import { ProviderError, type EntradaProvedor, type Provedorlike } from './types';

export const gemini: Provedorlike = {
  id: 'gemini',
  async executar({ apiKey, model, system, partes, jsonSchema, signal }: EntradaProvedor) {
    const parts = partes.map((p) =>
      p.kind === 'text' ? { text: p.text } : { inlineData: { mimeType: 'application/pdf', data: p.base64 } },
    );
    const data = await postJson(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema, temperature: 0.2 },
      },
      signal,
    );
    const cand = data?.candidates?.[0];
    const texto = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!texto) {
      const motivo = data?.promptFeedback?.blockReason || cand?.finishReason || 'resposta vazia';
      throw new ProviderError(`Gemini: sem conteúdo na resposta (${motivo}).`, 502, false);
    }
    return texto;
  },
};
