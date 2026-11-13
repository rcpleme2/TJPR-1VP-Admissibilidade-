import type { Provedor } from '../types/admissibility';
import { PROVEDORES } from '../../shared/schema';

/**
 * Armazenamento local (só preferências e chaves de API). Os registros dos casos ficam na nuvem. Chaves de API ficam em sessionStorage (somem ao fechar a aba)
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
  /** Última lista de modelos consultada em cada provedor. */
  modelosDisponiveis: Record<Provedor, Array<{ id: string; nome: string }>>;
}

export const CONFIG_PADRAO: ConfigMotor = {
  provider: 'gemini',
  model: { gemini: '', claude: '', gpt: '' },
  lembrarChaves: false,
  usarChaveDoServidor: false,
  modelosDisponiveis: { gemini: [], claude: [], gpt: [] },
};

const K_CONFIG = 'tjpr1vp:motor';
const K_KEYS = 'tjpr1vp:chaves';

export const lerConfig = (): ConfigMotor =>
  seguro(() => {
    const salvo = JSON.parse(localStorage.getItem(K_CONFIG) ?? '{}');
    return {
      ...CONFIG_PADRAO,
      ...salvo,
      model: { ...CONFIG_PADRAO.model, ...salvo.model },
      modelosDisponiveis: { ...CONFIG_PADRAO.modelosDisponiveis, ...salvo.modelosDisponiveis },
    };
  }, CONFIG_PADRAO);

const K_INSTRUCOES = 'tjpr1vp:instrucoes';

/** Instruções personalizadas da análise (vazio = usar as do sistema). */
export const lerInstrucoes = (): string => seguro(() => localStorage.getItem(K_INSTRUCOES) ?? '', '');
export const salvarInstrucoes = (t: string) =>
  seguro(() => (t.trim() ? localStorage.setItem(K_INSTRUCOES, t) : localStorage.removeItem(K_INSTRUCOES)), undefined);
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

/** Esquece configurações e chaves de API guardadas neste navegador. */
export function apagarDadosLocais() {
  seguro(() => {
    [K_KEYS, K_CONFIG].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(K_KEYS);
  }, undefined);
}

export const PROVEDORES_UI = PROVEDORES;
