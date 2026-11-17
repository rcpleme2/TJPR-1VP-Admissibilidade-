import { describe, expect, it } from 'vitest';
import { escolherNivel, nivelDoValor, valorNivel } from '../shared/modelos';
import { esquemaParaClaude } from '../server/providers/claude';
import { modelOutputJsonSchema } from '../shared/schema';

describe('níveis de modelo', () => {
  it('escolhe o mais recente de cada família entre os modelos da chave', () => {
    const gemini = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-preview-09-2026', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-pro', 'gemini-3.1-pro-preview', 'gemini-3.8-flash-tts'];
    expect(escolherNivel('gemini', 'basico', gemini)).toBe('gemini-3.5-flash-lite');
    expect(escolherNivel('gemini', 'intermediario', gemini)).toBe('gemini-3.8-flash');
    expect(escolherNivel('gemini', 'complexo', gemini)).toBe('gemini-3.1-pro-preview'); // a prévia mais nova vence o 2.5 estável
    expect(escolherNivel('gemini', 'complexo', [...gemini, 'gemini-3.1-pro'])).toBe('gemini-3.1-pro'); // mesma versão: a estável

    const claude = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-4-8', 'claude-sonnet-4-5-20250929', 'claude-fable-5-2'];
    expect(escolherNivel('claude', 'basico', claude)).toBe('claude-haiku-5-5');
    expect(escolherNivel('claude', 'intermediario', claude)).toBe('claude-sonnet-5-5');
    expect(escolherNivel('claude', 'complexo', claude)).toBe('claude-opus-5-5');

    const gpt = ['gpt-5', 'gpt-5.4', 'gpt-5.5', 'gpt-5.5-2026-06-01', 'gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.4-nano', 'gpt-5.5-chat-latest', 'gpt-4.1'];
    expect(escolherNivel('gpt', 'basico', gpt)).toBe('gpt-5.4-nano');
    expect(escolherNivel('gpt', 'intermediario', gpt)).toBe('gpt-5.4-mini');
    expect(escolherNivel('gpt', 'complexo', gpt)).toBe('gpt-5.5');
    expect(escolherNivel('gpt', 'basico', [])).toBeNull();
  });

  it('guarda o nível como "nivel:..."', () => {
    expect(nivelDoValor(valorNivel('complexo'))).toBe('complexo');
    expect(nivelDoValor('gemini-2.5-flash')).toBeNull();
  });

  it('ajusta o schema às restrições da saída estruturada do Claude', () => {
    const s = JSON.stringify(esquemaParaClaude(modelOutputJsonSchema()));
    expect(s).not.toMatch(/"(minLength|maxLength|minimum|maximum|minItems|maxItems|pattern|default)":/);
    expect((s.match(/"type":"object"/g) ?? []).length).toBe((s.match(/"additionalProperties":false/g) ?? []).length);
  });
});
