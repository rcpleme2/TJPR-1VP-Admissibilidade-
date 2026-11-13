import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ErroApi, nuvem, type UsuarioNuvem } from '../lib/nuvem';

interface Props {
  usuario: UsuarioNuvem;
  onClose: () => void;
}

export const ContaModal: React.FC<Props> = ({ usuario, onClose }) => {
  const [aba, setAba] = useState<'senha' | 'usuarios'>('senha');
  const [msg, setMsg] = useState('');
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [lista, setLista] = useState<UsuarioNuvem[]>([]);
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', papel: 'assessor' as 'admin' | 'assessor' });

  const carregar = useCallback(() => {
    if (usuario.papel === 'admin') nuvem.usuarios.listar().then(setLista).catch((e) => setMsg(e.message));
  }, [usuario.papel]);

  useEffect(() => {
    carregar();
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [carregar, onClose]);

  const tratar = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      carregar();
    } catch (e) {
      setMsg(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    }
  };

  const campo = 'bg-slate-50 text-xs border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-slate-600';
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="conta-titulo" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-300">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white">
          <h3 id="conta-titulo" className="text-sm font-bold text-slate-900">Conta e usuários</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 pt-3 flex gap-2 text-xs">
          <button onClick={() => setAba('senha')} className={`px-3 py-1.5 rounded-lg ${aba === 'senha' ? 'bg-slate-900 text-white' : 'border border-slate-300'}`}>Minha senha</button>
          {usuario.papel === 'admin' && <button onClick={() => setAba('usuarios')} className={`px-3 py-1.5 rounded-lg ${aba === 'usuarios' ? 'bg-slate-900 text-white' : 'border border-slate-300'}`}>Usuários</button>}
        </div>
        <div className="p-5 space-y-3 text-xs">
          {msg && <p role="status" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800">{msg}</p>}

          {aba === 'senha' && (
            <form
              className="space-y-2 max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                tratar(() => nuvem.trocarSenha(atual, nova), 'Senha alterada.').then(() => { setAtual(''); setNova(''); });
              }}
            >
              <input aria-label="Senha atual" type="password" autoComplete="current-password" placeholder="Senha atual" value={atual} onChange={(e) => setAtual(e.target.value)} className={`${campo} w-full`} />
              <input aria-label="Nova senha" type="password" autoComplete="new-password" placeholder="Nova senha (mínimo 10 caracteres)" value={nova} onChange={(e) => setNova(e.target.value)} className={`${campo} w-full`} />
              <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold">Alterar senha</button>
            </form>
          )}

          {aba === 'usuarios' && (
            <>
              <table className="w-full">
                <thead><tr className="text-left text-slate-500"><th className="py-1">Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th /></tr></thead>
                <tbody>
                  {lista.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="py-1.5">{u.nome}</td>
                      <td>{u.email}</td>
                      <td>
                        <select aria-label={`Papel de ${u.nome}`} value={u.papel} disabled={u.id === usuario.id} onChange={(e) => tratar(() => nuvem.usuarios.atualizar(u.id, { papel: e.target.value as 'admin' | 'assessor' }), 'Papel atualizado.')} className="bg-slate-50 border border-slate-300 rounded px-1 py-0.5">
                          <option value="assessor">assessor</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>{u.ativo ? 'ativo' : 'desativado'}</td>
                      <td className="text-right space-x-2">
                        {u.id !== usuario.id && (
                          <button onClick={() => tratar(() => nuvem.usuarios.atualizar(u.id, { ativo: !u.ativo }), u.ativo ? 'Usuário desativado.' : 'Usuário reativado.')} className="underline">
                            {u.ativo ? 'desativar' : 'reativar'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const s = window.prompt(`Nova senha para ${u.nome} (mínimo 10 caracteres):`);
                            if (s) tratar(() => nuvem.usuarios.atualizar(u.id, { senha: s }), 'Senha redefinida.');
                          }}
                          className="underline"
                        >
                          redefinir senha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <form
                className="flex flex-wrap gap-2 pt-2 border-t border-slate-100"
                onSubmit={(e) => {
                  e.preventDefault();
                  tratar(() => nuvem.usuarios.criar(novo), 'Usuário criado.').then(() => setNovo({ nome: '', email: '', senha: '', papel: 'assessor' }));
                }}
              >
                <input aria-label="Nome" placeholder="Nome" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={campo} />
                <input aria-label="E-mail" type="email" placeholder="E-mail" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={campo} />
                <input aria-label="Senha inicial" type="password" autoComplete="new-password" placeholder="Senha inicial (10+)" required value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} className={campo} />
                <select aria-label="Papel" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as 'admin' | 'assessor' })} className={campo}>
                  <option value="assessor">assessor</option>
                  <option value="admin">admin</option>
                </select>
                <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold">Criar usuário</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
