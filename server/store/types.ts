import type { EntradaBase } from '../../shared/precedentesBase';
import type { Autor, Caso, CasoResumo, EntradaHistorico, RegistroDados } from '../../shared/registro';

export type Papel = 'admin' | 'assessor';

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  senhaHash: string;
  criadoEm: string;
  atualizadoEm: string;
}
export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

export interface EntradaBaseNuvem extends EntradaBase {
  atualizadoPor: Autor;
  atualizadoEm: string;
}

export type ResultadoCriar = { ok: true; caso: Caso } | { ok: false; motivo: 'numero_duplicado'; existente: CasoResumo };

export type ResultadoAtualizar =
  | { ok: true; caso: Caso }
  | { ok: false; motivo: 'nao_encontrado' }
  | { ok: false; motivo: 'conflito'; atual: CasoResumo }
  | { ok: false; motivo: 'numero_duplicado'; existente: CasoResumo };

export interface Montagem {
  caso: Caso;
  /** Resumo gravado no histórico; a versão anterior (snapshot) também é preservada. */
  resumo: string[];
}

export interface Store {
  usuarios: {
    contar(): Promise<number>;
    porId(id: string): Promise<Usuario | null>;
    porEmail(email: string): Promise<Usuario | null>;
    listar(): Promise<Usuario[]>;
    criar(u: Usuario): Promise<{ ok: true } | { ok: false; motivo: 'email_duplicado' }>;
    atualizar(id: string, patch: Partial<Omit<Usuario, 'id' | 'email'>>): Promise<Usuario | null>;
  };
  casos: {
    listar(limite: number): Promise<CasoResumo[]>;
    obter(id: string): Promise<Caso | null>;
    /** Cria de forma atômica garantindo um único registro por número de processo. */
    criar(caso: Caso): Promise<ResultadoCriar>;
    /**
     * Atualização com controle de concorrência otimista: só aplica se a versão gravada for `baseVersao`.
     * `montar` recebe o registro atual e devolve o novo (versão = atual + 1). Grava também o snapshot anterior no histórico.
     */
    atualizar(id: string, baseVersao: number, montar: (atual: Caso) => Montagem | null): Promise<ResultadoAtualizar>;
    excluir(id: string): Promise<boolean>;
    historico(id: string): Promise<EntradaHistorico[]>;
    versao(id: string, versao: number): Promise<RegistroDados | null>;
  };
  base: {
    listar(): Promise<EntradaBaseNuvem[]>;
    salvar(e: EntradaBaseNuvem): Promise<void>;
    excluir(chave: string): Promise<void>;
  };
}

export const MAX_HISTORICO = 50;

export const resumoDe = (c: Caso): CasoResumo => {
  const { dados: _dados, ...resumo } = c;
  return resumo;
};
