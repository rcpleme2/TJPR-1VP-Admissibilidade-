/**
 * Resolve o nível escolhido (básico, intermediário, complexo) no modelo concreto do fornecedor: o mais recente da
 * família entre os que a chave pode usar (lista em cache por 6 horas, por chave), ou o nome de reserva.
 * Um nome de modelo explícito (vindo de variável de ambiente ou de versões antigas da tela) é usado como está.
 */
import crypto from 'node:crypto';
import type { Provedor } from '../shared/schema';
import { escolherNivel, MODELOS_RESERVA, NIVEIS, nivelDoValor, type Nivel } from '../shared/modelos';
import { listarModelos } from './providers/modelos';

const VALIDADE_MS = 6 * 3600_000;
const cache = new Map<string, { ids: string[]; ate: number }>();

/** Reserva ajustável por ambiente: MODELO_GEMINI_COMPLEXO, MODELO_CLAUDE_BASICO etc. */
export const reserva = (p: Provedor, n: Nivel) => process.env[`MODELO_${p.toUpperCase()}_${n.toUpperCase()}`] || MODELOS_RESERVA[p][n];

async function idsDisponiveis(p: Provedor, apiKey: string): Promise<string[] | null> {
  const k = `${p}:${crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16)}`;
  const c = cache.get(k);
  if (c && c.ate > Date.now()) return c.ids;
  try {
    const ids = (await listarModelos(p, apiKey)).map((m) => m.id);
    cache.set(k, { ids, ate: Date.now() + VALIDADE_MS });
    return ids;
  } catch {
    return null;
  }
}

export interface ModeloResolvido {
  id: string;
  nivel: Nivel | null;
  origem: 'lista' | 'reserva' | 'explicito';
}

export async function resolverModelo(p: Provedor, pedido: string | undefined, apiKey: string): Promise<ModeloResolvido> {
  if (pedido && !nivelDoValor(pedido)) return { id: pedido, nivel: null, origem: 'explicito' };
  const nivel = nivelDoValor(pedido) ?? 'intermediario';
  const ids = await idsDisponiveis(p, apiKey);
  const escolhido = ids ? escolherNivel(p, nivel, ids) : null;
  return escolhido ? { id: escolhido, nivel, origem: 'lista' } : { id: reserva(p, nivel), nivel, origem: 'reserva' };
}

/** Os três níveis resolvidos para a chave (para mostrar na tela). */
export async function niveisResolvidos(p: Provedor, apiKey: string): Promise<Record<Nivel, ModeloResolvido>> {
  const ids = await idsDisponiveis(p, apiKey);
  const out = {} as Record<Nivel, ModeloResolvido>;
  for (const n of NIVEIS) {
    const e = ids ? escolherNivel(p, n, ids) : null;
    out[n] = e ? { id: e, nivel: n, origem: 'lista' } : { id: reserva(p, n), nivel: n, origem: 'reserva' };
  }
  return out;
}
