import { detectarInjecao, type AlertaInjecao } from '../shared/injecao';

/**
 * Mitigação (PARCIAL) de prompt injection em texto fornecido pelo usuário: aponta instruções à IA (shared/injecao.ts)
 * e neutraliza delimitadores e caracteres invisíveis. PDFs enviados no original (escaneados) não são inspecionados
 * aqui: o modelo é instruído a reportá-los em "alertasManipulacao".
 * A defesa real é arquitetural: delimitadores, instrução de sistema, validação de schema
 * na saída e revisão humana obrigatória da minuta.
 */

export function sanitizeUntrustedInput(raw: string, documento?: string): { sanitized: string; alertas: AlertaInjecao[] } {
  if (!raw) return { sanitized: '', alertas: [] };
  let text = String(raw);
  const alertas = detectarInjecao(text, documento);

  // impede que o conteúdo "feche" as tags de delimitação ou imite marcadores de sistema
  text = text
    .replace(/<\/?\s*UNTRUSTED_[A-Z_]*[^>]*>/gi, '[DELIMITADOR_REMOVIDO]')
    .replace(/\[SYSTEM\]/gi, '[TEXTO]')
    .replace(/\[AI_STUDIO_METADATA[^\]]*\]/gi, '[TEXTO]');
  // caracteres de controle e de direção de texto (usados para ocultar instruções)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏‪-‮⁦-⁩]/g, '');

  return { sanitized: text, alertas };
}

/** Remove segredos que possam aparecer em mensagens de erro de provedores. */
export function redigirSegredos(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[chave]')
    .replace(/sk-[A-Za-z0-9_\-]{16,}/g, '[chave]')
    .replace(/(api[_-]?key["':= ]+)[^\s"']{8,}/gi, '$1[chave]')
    .slice(0, 300);
}
