/**
 * Detecção de instruções dirigidas à IA embutidas nas peças ou nas observações (prompt injection).
 *
 * É um alerta, não uma barreira: a defesa principal é arquitetural (conteúdo delimitado como dado não confiável,
 * regras fixas no prompt de sistema, saída validada por schema, prazos e precedentes recalculados em código e revisão
 * humana obrigatória). Aqui só se aponta ao usuário, com o trecho e a página, o que tem cara de comando à IA.
 * Roda no navegador (ao anexar) e no servidor (antes de enviar ao modelo).
 */

export interface AlertaInjecao {
  /** O que foi encontrado, em linguagem simples. */
  descricao: string;
  /** Trecho do documento em volta do achado. */
  trecho: string;
  /** Página, quando o texto tem marcadores "[p. N]". */
  pagina?: number;
  /** Documento em que foi encontrado (nome do arquivo ou "Observações"). */
  documento?: string;
}

const PADROES: Array<{ re: RegExp; descricao: string }> = [
  // desconsiderar instruções
  { re: /\bignor(?:e|ar|em)\s+(?:all\s+|todas?\s+(?:as\s+)?)?(?:the\s+|as\s+|os\s+|suas\s+)?(?:previous\s+|prior\s+|above\s+)?(?:instructions|prompt|instru[çc][õo]es|(?:regras|ordens|orienta[çc][õo]es)\s+(?:anteriores|acima|pr[ée]vias|do\s+sistema))/i, descricao: 'Ordem para ignorar instruções' },
  { re: /\bdisregard\s+(?:all\s+|any\s+)?(?:previous|prior|above|the)\b/i, descricao: 'Ordem para ignorar instruções' },
  { re: /\b(?:esque[çc]a|desconsidere|desconsiderar|despreze)\s+(?:todas?\s+)?(?:as\s+|os\s+|suas\s+|seus\s+)?(?:instru[çc][õo]es|diretrizes|(?:regras|ordens|orienta[çc][õo]es)\s+(?:anteriores|acima|pr[ée]vias|do\s+sistema))/i, descricao: 'Ordem para desconsiderar regras' },
  { re: /\bforget\s+(?:all\s+|everything|your)\b/i, descricao: 'Ordem para desconsiderar regras' },
  { re: /\bnew\s+instructions?\s*:|\bnovas\s+instru[çc][õo]es\s*:/i, descricao: 'Bloco de "novas instruções"' },
  // redefinir o papel do modelo
  { re: /\b(?:voc[êe]\s+(?:agora\s+)?(?:é|e|deve\s+agir\s+como|passa\s+a\s+ser)\s+(?:um|uma|o|a)\s+(?:assistente|ia|modelo|chatbot|advogad)|a\s+partir\s+de\s+agora,?\s+voc[êe])/i, descricao: 'Tentativa de redefinir o papel da IA' },
  { re: /\byou\s+are\s+now\b|\bact\s+as\s+(?:an?\s+)?(?:ai|assistant|chatbot)\b|\bfrom\s+now\s+on,?\s+you\b/i, descricao: 'Tentativa de redefinir o papel da IA' },
  // dirigir-se ao modelo
  { re: /\b(?:aten[çc][ãa]o|nota|instru[çc][ãa]o|mensagem)\s+(?:para|à|a|ao)\s+(?:a\s+)?(?:ia|intelig[êe]ncia\s+artificial|modelo\s+de\s+linguagem|chatgpt|gpt|gemini|claude|llm|assistente\s+virtual)\b/i, descricao: 'Mensagem dirigida à IA' },
  { re: /\b(?:note|message|instruction)s?\s+(?:to|for)\s+(?:the\s+)?(?:ai|llm|model|assistant|chatgpt|gemini|claude)\b/i, descricao: 'Mensagem dirigida à IA' },
  { re: /\bse\s+voc[êe]\s+(?:é|e|for)\s+(?:uma?\s+)?(?:ia|intelig[êe]ncia\s+artificial|modelo|assistente|rob[ôo])\b|\bif\s+you\s+are\s+(?:an?\s+)?(?:ai|llm|language\s+model|assistant)\b/i, descricao: 'Mensagem dirigida à IA' },
  // marcadores de sistema
  { re: /<\/?\s*(?:system|instructions?|untrusted_[a-z_]*)\s*>|\[\s*(?:system|inst)\s*\]|<<\s*sys\s*>>|\bsystem\s*(?:prompt|override|message)\b/i, descricao: 'Marcador que imita instruções de sistema' },
  { re: /\bjailbreak\b|\bdan\s+mode\b|\bdeveloper\s+mode\b|\bmodo\s+desenvolvedor\b/i, descricao: 'Padrão conhecido de jailbreak' },
  // forçar o resultado
  { re: /\b(?:declare|considere|trate|classifique|marque)\s+(?:este|o|esse)\s+recurso\s+(?:como\s+)?(?:admitido|admiss[íi]vel|tempestivo|conforme)/i, descricao: 'Ordem para forçar o resultado do exame' },
  { re: /\b(?:admita|admitir|deve\s+admitir|admitam)\s+(?:este|o|esse)\s+recurso\b(?:[^.]{0,40})\b(?:sem|independentemente)\b/i, descricao: 'Ordem para forçar o resultado do exame' },
  { re: /\b(?:n[ãa]o\s+(?:aponte|aplique|mencione|indique)\s+(?:a\s+|nenhuma\s+|qualquer\s+)?(?:s[úu]mula|[óo]bice))/i, descricao: 'Ordem para ocultar óbices' },
  { re: /\bforce\s+(?:admission|admissibilidade|approval)\b|\b(?:always|must)\s+(?:admit|approve|grant)\b/i, descricao: 'Ordem para forçar o resultado do exame' },
  // exfiltração
  { re: /\b(?:reveal|show|print|repeat)\s+(?:your\s+|the\s+)?(?:api\s+key|system\s+prompt|instructions|secret)/i, descricao: 'Pedido para revelar instruções ou chaves' },
  { re: /\b(?:mostre|revele|exiba|repita|imprima)\s+(?:a\s+|o\s+|as\s+|suas\s+|seu\s+)?(?:chave|prompt|instru[çc][õo]es\s+(?:de\s+sistema|internas))/i, descricao: 'Pedido para revelar instruções ou chaves' },
];

/** Caracteres invisíveis ou de inversão de direção, usados para esconder texto. */
const INVISIVEIS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g;

function paginaEm(texto: string, pos: number): number | undefined {
  const antes = texto.slice(0, pos);
  const m = antes.match(/\[p\.\s*(\d+)\]/g);
  return m ? Number(m[m.length - 1].replace(/\D/g, '')) : undefined;
}

function trechoEm(texto: string, inicio: number, fim: number): string {
  const a = Math.max(0, inicio - 80);
  const b = Math.min(texto.length, fim + 80);
  return `${a > 0 ? '…' : ''}${texto.slice(a, b).replace(/\s+/g, ' ').trim()}${b < texto.length ? '…' : ''}`;
}

/** Procura instruções à IA no texto. Devolve no máximo `limite` alertas, sem repetir o mesmo tipo na mesma página. */
export function detectarInjecao(texto: string, documento?: string, limite = 8): AlertaInjecao[] {
  if (!texto) return [];
  const out: Array<AlertaInjecao & { ini: number; fim: number }> = [];
  for (const { re, descricao } of PADROES) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of texto.matchAll(global)) {
      const ini = m.index ?? 0;
      const fim = ini + m[0].length;
      // achados no mesmo trecho viram um alerta só, com as descrições somadas
      const perto = out.find((a) => ini < a.fim + 120 && fim > a.ini - 120);
      if (perto) {
        if (!perto.descricao.split('; ').includes(descricao)) perto.descricao += `; ${descricao.charAt(0).toLowerCase()}${descricao.slice(1)}`;
        perto.ini = Math.min(perto.ini, ini);
        perto.fim = Math.max(perto.fim, fim);
        perto.trecho = trechoEm(texto, perto.ini, perto.fim);
        continue;
      }
      if (out.length >= limite) continue;
      out.push({ descricao, trecho: trechoEm(texto, ini, fim), pagina: paginaEm(texto, ini), documento, ini, fim });
    }
  }
  out.sort((a, b) => a.ini - b.ini);
  const invisiveis = texto.match(INVISIVEIS)?.length ?? 0;
  if (invisiveis >= 5) {
    out.push({ descricao: `${invisiveis} caracteres invisíveis ou de inversão de direção (podem esconder texto)`, trecho: '', documento, ini: texto.length, fim: texto.length });
  }
  return out.map(({ ini: _i, fim: _f, ...a }) => a);
}

/** Texto de um alerta numa linha, para listas e logs. */
export const descreverAlerta = (a: AlertaInjecao) =>
  `${a.documento ? `${a.documento}${a.pagina ? `, p. ${a.pagina}` : ''}: ` : a.pagina ? `p. ${a.pagina}: ` : ''}${a.descricao}${a.trecho ? ` — "${a.trecho}"` : ''}`;
