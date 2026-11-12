import type { EntradaBase } from '../../shared/precedentesBase';
import type { AdmissibilityAnalysisResult, Provedor } from '../types/admissibility';
import { AdmissibilityAnalysisResultSchema, PROVEDORES } from '../../shared/schema';

/**
 * Armazenamento local. Chaves de API ficam em sessionStorage (somem ao fechar a aba)
 * a menos que o usuário peça para lembrar; nesse caso vão para localStorage.
 */

function seguro<T>(fn: () => T, padrao: T): T {
  try {
    return fn();
  } catch {
    return padrao;
  }
}

export interface ConfigMotor {
  provider: Provedor;
  model: Record<Provedor, string>;
  lembrarChaves: boolean;
  usarChaveDoServidor: boolean;
}

export const CONFIG_PADRAO: ConfigMotor = {
  provider: 'gemini',
  model: { gemini: '', claude: '', gpt: '' },
  lembrarChaves: false,
  usarChaveDoServidor: false,
};

const K_CONFIG = 'tjpr1vp:motor';
const K_KEYS = 'tjpr1vp:chaves';
const K_TOKEN = 'tjpr1vp:token';
const K_HIST = 'tjpr1vp:historico';
const K_BASE = 'tjpr1vp:base-precedentes';
const K_SALVAR = 'tjpr1vp:salvar-local';

export const lerConfig = (): ConfigMotor =>
  seguro(() => ({ ...CONFIG_PADRAO, ...JSON.parse(localStorage.getItem(K_CONFIG) ?? '{}') }), CONFIG_PADRAO);
export const salvarConfig = (c: ConfigMotor) => seguro(() => localStorage.setItem(K_CONFIG, JSON.stringify(c)), undefined);

type Chaves = Partial<Record<Provedor, string>>;

export function lerChaves(): Chaves {
  const doStore = (s: Storage) => seguro(() => JSON.parse(s.getItem(K_KEYS) ?? '{}') as Chaves, {});
  return { ...doStore(localStorage), ...doStore(sessionStorage) };
}

export function salvarChaves(chaves: Chaves, lembrar: boolean) {
  seguro(() => {
    localStorage.removeItem(K_KEYS);
    sessionStorage.removeItem(K_KEYS);
    (lembrar ? localStorage : sessionStorage).setItem(K_KEYS, JSON.stringify(chaves));
  }, undefined);
}

export const lerToken = () => seguro(() => sessionStorage.getItem(K_TOKEN) ?? '', '');
export const salvarToken = (t: string) => seguro(() => sessionStorage.setItem(K_TOKEN, t), undefined);

export const salvarLocalAtivo = () => seguro(() => localStorage.getItem(K_SALVAR) !== '0', true);
export const definirSalvarLocal = (v: boolean) => seguro(() => localStorage.setItem(K_SALVAR, v ? '1' : '0'), undefined);

// --- Histórico de análises ---------------------------------------------------

export interface RegistroHistorico {
  id: string;
  atualizadoEm: string;
  numero: string;
  materia: string;
  resultado: AdmissibilityAnalysisResult;
}

const MAX_HIST = 10;

export function lerHistorico(): RegistroHistorico[] {
  return seguro(() => {
    const bruto = JSON.parse(localStorage.getItem(K_HIST) ?? '[]') as RegistroHistorico[];
    return bruto.filter((r) => AdmissibilityAnalysisResultSchema.safeParse(r.resultado).success);
  }, []);
}

export function salvarNoHistorico(id: string, resultado: AdmissibilityAnalysisResult) {
  if (!salvarLocalAtivo()) return;
  seguro(() => {
    const outros = lerHistorico().filter((r) => r.id !== id);
    const novo: RegistroHistorico = {
      id,
      atualizadoEm: new Date().toISOString(),
      numero: resultado.processo.numero,
      materia: resultado.processo.materia,
      resultado,
    };
    localStorage.setItem(K_HIST, JSON.stringify([novo, ...outros].slice(0, MAX_HIST)));
  }, undefined);
}

export const removerDoHistorico = (id: string) =>
  seguro(() => localStorage.setItem(K_HIST, JSON.stringify(lerHistorico().filter((r) => r.id !== id))), undefined);

export function apagarDadosLocais() {
  seguro(() => {
    [K_HIST, K_BASE, K_KEYS, K_CONFIG].forEach((k) => localStorage.removeItem(k));
    [K_KEYS, K_TOKEN].forEach((k) => sessionStorage.removeItem(k));
  }, undefined);
}

// --- Base própria de precedentes ----------------------------------------------

export const lerBaseCustom = (): EntradaBase[] => seguro(() => JSON.parse(localStorage.getItem(K_BASE) ?? '[]') as EntradaBase[], []);
export const salvarBaseCustom = (b: EntradaBase[]) => seguro(() => localStorage.setItem(K_BASE, JSON.stringify(b)), undefined);

export const PROVEDORES_UI = PROVEDORES;
