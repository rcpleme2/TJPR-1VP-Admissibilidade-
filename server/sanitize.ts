/**
 * Mitigação (PARCIAL) de prompt injection em texto fornecido pelo usuário.
 * Limitações: não inspeciona o conteúdo dos PDFs, que seguem como anexo ao modelo.
 * A defesa real é arquitetural: delimitadores, instrução de sistema, validação de schema
 * na saída e revisão humana obrigatória da minuta.
 */

const PADROES: Array<{ pattern: RegExp; desc: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i, desc: 'Comando de ignorar instruções prévias' },
  { pattern: /esque[çc]a\s+(todas\s+as\s+)?(as\s+)?instru[çc][õo]es/i, desc: 'Comando em português para desconsiderar regras' },
  { pattern: /desconsidere\s+(todas\s+as\s+)?regras/i, desc: 'Tentativa de desconsideração de regras' },
  { pattern: /voc[êe]\s+agora\s+[ée]\s+/i, desc: 'Tentativa de redefinição de persona' },
  { pattern: /you\s+are\s+now\s+/i, desc: 'Tentativa de redefinição de persona' },
  { pattern: /system\s*override/i, desc: 'Tentativa de sobreposição do sistema' },
  { pattern: /jailbreak|\bdan\s+mode\b/i, desc: 'Padrão de jailbreak clássico' },
  { pattern: /declare\s+este\s+recurso\s+admitido/i, desc: 'Tentativa de forçar admissibilidade positiva' },
  { pattern: /force\s+(admission|admissibilidade)/i, desc: 'Tentativa imperativa de forçar admissão' },
  { pattern: /reveal\s+(api\s+key|system\s+prompt|secret)/i, desc: 'Tentativa de exfiltração de segredos' },
  { pattern: /mostre\s+(a\s+chave|o\s+prompt|suas\s+instru[çc][õo]es)/i, desc: 'Tentativa de vazamento de prompt de sistema' },
];

export function sanitizeUntrustedInput(raw: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!raw) return { sanitized: '', warnings };
  let text = String(raw);

  for (const { pattern, desc } of PADROES) {
    if (pattern.test(text)) warnings.push(`Padrão suspeito sinalizado: ${desc}.`);
  }

  // impede que o conteúdo "feche" as tags de delimitação ou imite marcadores de sistema
  text = text
    .replace(/<\/?\s*UNTRUSTED_[A-Z_]*[^>]*>/gi, '[DELIMITADOR_REMOVIDO]')
    .replace(/\[SYSTEM\]/gi, '[TEXTO]')
    .replace(/\[AI_STUDIO_METADATA[^\]]*\]/gi, '[TEXTO]');
  // caracteres de controle e de direção de texto (usados para ocultar instruções)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏‪-‮⁦-⁩]/g, '');

  return { sanitized: text, warnings: [...new Set(warnings)] };
}

/** Remove segredos que possam aparecer em mensagens de erro de provedores. */
export function redigirSegredos(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[chave]')
    .replace(/sk-[A-Za-z0-9_\-]{16,}/g, '[chave]')
    .replace(/(api[_-]?key["':= ]+)[^\s"']{8,}/gi, '$1[chave]')
    .slice(0, 300);
}
