import type { EntradaBase } from '../../shared/precedentesBase';
import type { Caso, CasoResumo, EntradaHistorico, RegistroDados, StatusCaso } from '../../shared/registro';

export interface UsuarioNuvem {
  id: string;
  email: string;
  nome: string;
  papel: 'admin' | 'assessor';
  ativo: boolean;
}

export type EntradaBaseNuvem = EntradaBase & { atualizadoPor?: { id: string; nome: string }; atualizadoEm?: string };

export class ErroApi extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function req<T>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* corpo vazio */
  }
  if (!res.ok) {
    throw new ErroApi(String(json.error ?? `Falha na comunicação com o servidor (HTTP ${res.status}).`), res.status, json.codigo as string | undefined, json);
  }
  return json as T;
}

export const nuvem = {
  me: () => req<{ usuario: UsuarioNuvem }>('GET', '/api/auth/me').then((r) => r.usuario),
  login: (email: string, senha: string) => req<{ usuario: UsuarioNuvem }>('POST', '/api/auth/login', { email, senha }).then((r) => r.usuario),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),
  trocarSenha: (atual: string, nova: string) => req<{ ok: true }>('POST', '/api/auth/senha', { atual, nova }),

  usuarios: {
    listar: () => req<{ usuarios: UsuarioNuvem[] }>('GET', '/api/usuarios').then((r) => r.usuarios),
    criar: (u: { email: string; nome: string; senha: string; papel: 'admin' | 'assessor' }) => req<{ usuario: UsuarioNuvem }>('POST', '/api/usuarios', u),
    atualizar: (id: string, p: Partial<{ nome: string; papel: 'admin' | 'assessor'; ativo: boolean; senha: string }>) => req<{ usuario: UsuarioNuvem }>('PATCH', `/api/usuarios/${id}`, p),
  },

  casos: {
    listar: (busca = '') => req<{ casos: CasoResumo[] }>('GET', `/api/casos?busca=${encodeURIComponent(busca)}`).then((r) => r.casos),
    obter: (id: string) => req<{ caso: Caso }>('GET', `/api/casos/${id}`).then((r) => r.caso),
    criar: (dados: RegistroDados, status?: StatusCaso) => req<{ caso: Caso }>('POST', '/api/casos', { dados, status }).then((r) => r.caso),
    atualizar: (id: string, baseVersao: number, dados: RegistroDados, status?: StatusCaso) =>
      req<{ caso: Caso }>('PUT', `/api/casos/${id}`, { baseVersao, dados, status }).then((r) => r.caso),
    excluir: (id: string) => req<{ ok: true }>('DELETE', `/api/casos/${id}`),
    historico: (id: string) => req<{ historico: EntradaHistorico[] }>('GET', `/api/casos/${id}/historico`).then((r) => r.historico),
    versao: (id: string, v: number) => req<{ dados: RegistroDados }>('GET', `/api/casos/${id}/historico/${v}`).then((r) => r.dados),
  },

  base: {
    listar: () => req<{ entradas: EntradaBaseNuvem[] }>('GET', '/api/base-precedentes').then((r) => r.entradas),
    salvar: (entradas: EntradaBase[]) =>
      req<{ entradas: EntradaBaseNuvem[] }>('POST', '/api/base-precedentes', {
        entradas: entradas.map(({ tipo, tribunal, numero, enunciado, situacao, palavrasChave }) => ({ tipo, tribunal, numero, enunciado, situacao, palavrasChave })),
      }).then((r) => r.entradas),
  },
};
