/**
 * Base de temas do STJ (dados abertos), baixada sob demanda e mantida em memória.
 * Atualiza a cada 12 horas; se o download falhar, segue com a última cópia (e avisa a idade).
 * STJ_TEMAS_URL troca o endereço; STJ_TEMAS_ARQUIVO lê de um arquivo local (desenvolvimento e testes).
 */
import { readFile } from 'node:fs/promises';
import { indexar, lerTemasStj, type IndiceTemas } from '../shared/temasStj';

export const URL_TEMAS_STJ =
  process.env.STJ_TEMAS_URL ||
  'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/df29da13-7d6b-41ba-ad96-cd1a5bbd191c/download/temas.csv';

const VALIDADE_MS = 12 * 3600_000;
const ESPERA_FALHA_MS = 10 * 60_000;

export interface BaseStj {
  indice: IndiceTemas;
  /** Quando a cópia em uso foi baixada. */
  atualizadaEm: string;
}

let atual: BaseStj | null = null;
let carregando: Promise<BaseStj | null> | null = null;
let ultimaFalha = 0;
let ultimoErro = '';

async function baixar(): Promise<string> {
  if (process.env.STJ_TEMAS_ARQUIVO) return readFile(process.env.STJ_TEMAS_ARQUIVO, 'utf8');
  const r = await fetch(URL_TEMAS_STJ, { signal: AbortSignal.timeout(30_000), headers: { accept: 'text/csv,*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function carregar(): Promise<BaseStj | null> {
  try {
    const temas = lerTemasStj(await baixar());
    if (temas.length < 100) throw new Error(`só ${temas.length} temas lidos`);
    atual = { indice: indexar(temas), atualizadaEm: new Date().toISOString() };
    ultimoErro = '';
    console.log(JSON.stringify({ severity: 'INFO', evento: 'temas_stj_atualizados', temas: temas.length }));
  } catch (e) {
    ultimaFalha = Date.now();
    ultimoErro = (e as Error).message;
    console.log(JSON.stringify({ severity: 'WARNING', evento: 'temas_stj_falha', erro: ultimoErro }));
  }
  return atual;
}

/**
 * A base, se disponível. Na primeira vez espera o download (até `esperaMs`); depois responde com a cópia em memória
 * e atualiza em segundo plano quando ela vence.
 */
export async function baseStj(esperaMs = 15_000): Promise<BaseStj | null> {
  const vencida = !atual || Date.now() - Date.parse(atual.atualizadaEm) > VALIDADE_MS;
  const podeTentar = Date.now() - ultimaFalha > ESPERA_FALHA_MS;
  if (vencida && podeTentar && !carregando) carregando = carregar().finally(() => (carregando = null));
  if (atual) return atual;
  if (!carregando) return null;
  return Promise.race([carregando, new Promise<null>((r) => setTimeout(() => r(null), esperaMs))]);
}

export const statusBaseStj = () => ({ disponivel: Boolean(atual), atualizadaEm: atual?.atualizadaEm, temas: atual?.indice.temas.length ?? 0, erro: ultimoErro || undefined });

/** Para os testes: descarta a cópia em memória. */
export function _reiniciarBaseStj() {
  atual = null;
  carregando = null;
  ultimaFalha = 0;
}
