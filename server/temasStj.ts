/**
 * Base de temas do STJ (dados abertos).
 *
 * Atualização semanal: o download só acontece às sextas-feiras (horário de Brasília), fora do recesso de 20/12 a 06/01,
 * no primeiro uso do dia. A cópia baixada fica guardada no armazenamento do sistema (Firestore em produção), de modo que
 * as instâncias que sobem nos outros dias a leem dali, sem baixar de novo. A única exceção é não haver cópia nenhuma.
 * Se o download de sexta falhar, segue a cópia anterior e tenta de novo em 10 minutos.
 *
 * STJ_TEMAS_URL troca o endereço; STJ_TEMAS_ARQUIVO lê de um arquivo local (desenvolvimento e testes).
 */
import { readFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { indexar, lerTemasStj, type IndiceTemas } from '../shared/temasStj';
import type { Store } from './store/types';

export const URL_TEMAS_STJ =
  process.env.STJ_TEMAS_URL ||
  'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/df29da13-7d6b-41ba-ad96-cd1a5bbd191c/download/temas.csv';

const ARQUIVO = 'temas-stj.csv.gz';
const ESPERA_FALHA_MS = 10 * 60_000;
const FUSO = 'America/Sao_Paulo';

// --- calendário ---------------------------------------------------------------------------------

/** Data (aaaa-mm-dd) e dia da semana no horário de Brasília. */
export function diaLocal(d: Date): { data: string; semana: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, semana: p.weekday };
}

/** Recesso forense: de 20/12 a 06/01, todo ano. */
export function noRecesso(data: string): boolean {
  const [, m, d] = data.split('-').map(Number);
  return (m === 12 && d >= 20) || (m === 1 && d <= 6);
}

/** Dia de atualizar: sexta-feira fora do recesso. */
export function diaDeAtualizar(agora: Date): boolean {
  const { data, semana } = diaLocal(agora);
  return semana === 'Fri' && !noRecesso(data);
}

/** Baixar agora? Só sem cópia nenhuma, ou numa sexta de atualização se a cópia não é do próprio dia. */
export function deveBaixar(agora: Date, copiaEm: string | null | undefined): boolean {
  if (!copiaEm) return true;
  if (!diaDeAtualizar(agora)) return false;
  return diaLocal(new Date(copiaEm)).data < diaLocal(agora).data;
}

// --- serviço ------------------------------------------------------------------------------------

export interface BaseStj {
  indice: IndiceTemas;
  /** Quando a cópia em uso foi baixada do STJ. */
  atualizadaEm: string;
}

let store: Store | null = null;
let atual: BaseStj | null = null;
let carregando: Promise<BaseStj | null> | null = null;
let leuGuardada = false;
let ultimaLeitura = 0;
let ultimaFalha = 0;
let ultimoErro = '';

/** Liga o serviço ao armazenamento (para guardar e ler a cópia entre reinícios). */
export function configurarBaseStj(s: Store) {
  store = s;
}

const montar = (csv: string, em: string): BaseStj => {
  const temas = lerTemasStj(csv);
  if (temas.length < 100) throw new Error(`só ${temas.length} temas lidos`);
  return { indice: indexar(temas), atualizadaEm: em };
};

async function lerGuardada(): Promise<BaseStj | null> {
  if (!store) return null;
  try {
    const g = await store.arquivos.ler(ARQUIVO);
    return g ? montar(gunzipSync(g.dados).toString('utf8'), g.em) : null;
  } catch (e) {
    console.log(JSON.stringify({ severity: 'WARNING', evento: 'temas_stj_copia_invalida', erro: (e as Error).message }));
    return null;
  }
}

async function baixar(): Promise<string> {
  if (process.env.STJ_TEMAS_ARQUIVO) return readFile(process.env.STJ_TEMAS_ARQUIVO, 'utf8');
  const r = await fetch(URL_TEMAS_STJ, { signal: AbortSignal.timeout(30_000), headers: { accept: 'text/csv,*/*' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function atualizar(): Promise<BaseStj | null> {
  // 1) a cópia guardada (outra instância pode já ter baixado a desta sexta)
  if (!leuGuardada || (atual && deveBaixar(new Date(), atual.atualizadaEm) && Date.now() - ultimaLeitura > ESPERA_FALHA_MS)) {
    const g = await lerGuardada();
    leuGuardada = true;
    ultimaLeitura = Date.now();
    if (g && (!atual || g.atualizadaEm > atual.atualizadaEm)) atual = g;
  }
  if (!deveBaixar(new Date(), atual?.atualizadaEm)) return atual;
  if (Date.now() - ultimaFalha < ESPERA_FALHA_MS) return atual;

  // 2) download do STJ
  try {
    const csv = await baixar();
    const em = new Date().toISOString();
    atual = montar(csv, em);
    ultimoErro = '';
    console.log(JSON.stringify({ severity: 'INFO', evento: 'temas_stj_atualizados', temas: atual.indice.temas.length }));
    await store?.arquivos.gravar(ARQUIVO, gzipSync(csv), em).catch((e) => {
      console.log(JSON.stringify({ severity: 'WARNING', evento: 'temas_stj_copia_nao_gravada', erro: (e as Error).message }));
    });
  } catch (e) {
    ultimaFalha = Date.now();
    ultimoErro = (e as Error).message;
    console.log(JSON.stringify({ severity: 'WARNING', evento: 'temas_stj_falha', erro: ultimoErro }));
  }
  return atual;
}

/**
 * A base, se disponível. Com cópia em memória, responde na hora (e, numa sexta de atualização, baixa em segundo plano);
 * sem ela, espera a leitura da cópia guardada ou o download (até `esperaMs`).
 */
export async function baseStj(esperaMs = 15_000): Promise<BaseStj | null> {
  const precisa = !atual || !leuGuardada || deveBaixar(new Date(), atual.atualizadaEm);
  if (precisa && !carregando) carregando = atualizar().finally(() => (carregando = null));
  if (atual) return atual;
  if (!carregando) return null;
  return Promise.race([carregando, new Promise<null>((r) => setTimeout(() => r(null), esperaMs))]);
}

export const statusBaseStj = () => ({ disponivel: Boolean(atual), atualizadaEm: atual?.atualizadaEm, temas: atual?.indice.temas.length ?? 0, erro: ultimoErro || undefined });

/** Para os testes: descarta o estado em memória. */
export function _reiniciarBaseStj() {
  atual = null;
  carregando = null;
  leuGuardada = false;
  ultimaLeitura = 0;
  ultimaFalha = 0;
  ultimoErro = '';
}
