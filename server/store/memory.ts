import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Caso, EntradaHistorico, RegistroDados } from '../../shared/registro';
import { chaveBase } from '../../shared/precedentes';
import { MAX_HISTORICO, resumoDe, type EntradaBaseNuvem, type Store, type Usuario } from './types';

interface Dump {
  usuarios: Usuario[];
  casos: Caso[];
  historicos: Record<string, Array<EntradaHistorico & { dados: RegistroDados }>>;
  base: EntradaBaseNuvem[];
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * Implementação em memória, com persistência opcional em arquivo JSON (desenvolvimento e testes).
 * Instância única: NÃO use em produção com várias instâncias (use o Firestore).
 */
export function criarStoreMemoria(arquivo?: string): Store {
  const usuarios = new Map<string, Usuario>();
  const casos = new Map<string, Caso>();
  const historicos = new Map<string, Array<EntradaHistorico & { dados: RegistroDados }>>();
  const base = new Map<string, EntradaBaseNuvem>();

  if (arquivo && fs.existsSync(arquivo)) {
    const d = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Dump;
    d.usuarios.forEach((u) => usuarios.set(u.id, u));
    d.casos.forEach((c) => casos.set(c.id, c));
    Object.entries(d.historicos).forEach(([k, v]) => historicos.set(k, v));
    d.base.forEach((e) => base.set(chaveBase(e), e));
  }

  let fila: Promise<void> = Promise.resolve();
  const persistir = () => {
    if (!arquivo) return;
    const dump: Dump = { usuarios: [...usuarios.values()], casos: [...casos.values()], historicos: Object.fromEntries(historicos), base: [...base.values()] };
    const json = JSON.stringify(dump);
    fila = fila.then(async () => {
      await fs.promises.mkdir(path.dirname(arquivo), { recursive: true });
      const tmp = `${arquivo}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fs.promises.writeFile(tmp, json, { mode: 0o600 });
      await fs.promises.rename(tmp, arquivo);
    });
  };

  const porNumero = (n: string, ignorar?: string) => [...casos.values()].find((c) => c.id !== ignorar && n && soDigitos(c.numeroProcesso) === n);
  const soDigitos = (s: string) => s.replace(/\D/g, '');

  return {
    usuarios: {
      async contar() {
        return usuarios.size;
      },
      async porId(id) {
        return clone(usuarios.get(id) ?? null);
      },
      async porEmail(email) {
        return clone([...usuarios.values()].find((u) => u.email === email) ?? null);
      },
      async listar() {
        return clone([...usuarios.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      },
      async criar(u) {
        if ([...usuarios.values()].some((x) => x.email === u.email)) return { ok: false, motivo: 'email_duplicado' };
        usuarios.set(u.id, clone(u));
        persistir();
        return { ok: true };
      },
      async atualizar(id, patch) {
        const u = usuarios.get(id);
        if (!u) return null;
        const novo = { ...u, ...patch, atualizadoEm: new Date().toISOString() };
        usuarios.set(id, novo);
        persistir();
        return clone(novo);
      },
    },
    casos: {
      async listar(limite) {
        return [...casos.values()]
          .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
          .slice(0, limite)
          .map((c) => clone(resumoDe(c)));
      },
      async obter(id) {
        return clone(casos.get(id) ?? null);
      },
      async criar(caso) {
        const dup = porNumero(soDigitos(caso.numeroProcesso));
        if (dup) return { ok: false, motivo: 'numero_duplicado', existente: clone(resumoDe(dup)) };
        casos.set(caso.id, clone(caso));
        historicos.set(caso.id, [{ versao: caso.versao, por: caso.criadoPor, em: caso.criadoEm, resumo: ['Registro criado'], dados: clone(caso.dados) }]);
        persistir();
        return { ok: true, caso: clone(caso) };
      },
      async atualizar(id, baseVersao, montar) {
        const atual = casos.get(id);
        if (!atual) return { ok: false, motivo: 'nao_encontrado' };
        if (atual.versao !== baseVersao) return { ok: false, motivo: 'conflito', atual: clone(resumoDe(atual)) };
        const m = montar(clone(atual));
        if (!m) return { ok: true, caso: clone(atual) };
        const dup = porNumero(soDigitos(m.caso.numeroProcesso), id);
        if (dup) return { ok: false, motivo: 'numero_duplicado', existente: clone(resumoDe(dup)) };
        const h = historicos.get(id) ?? [];
        h.push({ versao: m.caso.versao, por: m.caso.atualizadoPor, em: m.caso.atualizadoEm, resumo: m.resumo, dados: clone(m.caso.dados) });
        historicos.set(id, h.slice(-MAX_HISTORICO));
        casos.set(id, clone(m.caso));
        persistir();
        return { ok: true, caso: clone(m.caso) };
      },
      async excluir(id) {
        const ok = casos.delete(id);
        historicos.delete(id);
        if (ok) persistir();
        return ok;
      },
      async historico(id) {
        return (historicos.get(id) ?? []).map(({ dados: _d, ...h }) => clone(h)).reverse();
      },
      async versao(id, versao) {
        const h = (historicos.get(id) ?? []).find((x) => x.versao === versao);
        return h ? clone(h.dados) : null;
      },
    },
    base: {
      async listar() {
        return clone([...base.values()]);
      },
      async salvar(e) {
        base.set(chaveBase(e), clone(e));
        persistir();
      },
      async excluir(chave) {
        base.delete(chave);
        persistir();
      },
    },
  };
}
