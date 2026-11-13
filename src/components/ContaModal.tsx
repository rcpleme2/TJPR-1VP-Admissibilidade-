import React, { useCallback, useEffect, useState } from 'react';
import { ErroApi, nuvem, type UsuarioNuvem } from '../lib/nuvem';
import { Abas, Botao, campo, campoSelect, Modal, Rotulo } from './ui';

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
  const admin = usuario.papel === 'admin';

  const carregar = useCallback(() => {
    if (admin) nuvem.usuarios.listar().then(setLista).catch((e) => setMsg(e.message));
  }, [admin]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const tratar = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      carregar();
    } catch (e) {
      setMsg(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    }
  };

  const acao = 'text-[13px] text-toga underline-offset-2 hover:underline';

  return (
    <Modal
      titulo="Conta"
      subtitulo={`${usuario.nome}, ${usuario.email}`}
      onClose={onClose}
      largura="max-w-2xl"
      cabecalhoExtra={
        admin ? (
          <Abas
            rotulo="Seções da conta"
            ativa={aba}
            onChange={(a) => {
              setAba(a);
              setMsg('');
            }}
            className="mt-3"
            itens={[
              { id: 'senha', rotulo: 'Minha senha' },
              { id: 'usuarios', rotulo: 'Usuários', contagem: lista.length },
            ]}
          />
        ) : undefined
      }
    >
      <div className="space-y-5 text-sm">
        {msg && (
          <p role="status" className="text-tinta-2">
            {msg}
          </p>
        )}

        {aba === 'senha' && (
          <form
            className="max-w-sm space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              tratar(() => nuvem.trocarSenha(atual, nova), 'Senha alterada.').then(() => {
                setAtual('');
                setNova('');
              });
            }}
          >
            <div>
              <Rotulo htmlFor="senha-atual">Senha atual</Rotulo>
              <input id="senha-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={campo} />
            </div>
            <div>
              <Rotulo htmlFor="senha-nova" dica="mínimo de 10 caracteres">
                Nova senha
              </Rotulo>
              <input id="senha-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={campo} />
            </div>
            <Botao type="submit" variante="primario">
              Alterar senha
            </Botao>
          </form>
        )}

        {aba === 'usuarios' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem]">
                <thead>
                  <tr className="border-b border-linha text-left text-[13px] text-tinta-3">
                    <th className="pb-2 pr-3 font-normal">Nome</th>
                    <th className="pb-2 pr-3 font-normal">Papel</th>
                    <th className="pb-2 pr-3 font-normal">Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {lista.map((u) => (
                    <tr key={u.id} className={u.ativo ? '' : 'text-tinta-3'}>
                      <td className="py-2.5 pr-3">
                        <span className="block text-tinta">{u.nome}</span>
                        <span className="block text-[13px] text-tinta-3">{u.email}</span>
                      </td>
                      <td className="pr-3">
                        <select
                          aria-label={`Papel de ${u.nome}`}
                          value={u.papel}
                          disabled={u.id === usuario.id}
                          onChange={(e) => tratar(() => nuvem.usuarios.atualizar(u.id, { papel: e.target.value as 'admin' | 'assessor' }), 'Papel atualizado.')}
                          className="h-8 rounded-md border border-linha bg-folha pl-2 pr-7 text-[13px] focus:border-toga focus:outline-none disabled:opacity-60"
                        >
                          <option value="assessor">Assessor</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="pr-3 text-[13px]">{u.ativo ? 'Ativo' : 'Desativado'}</td>
                      <td className="space-x-3 whitespace-nowrap text-right">
                        {u.id !== usuario.id && (
                          <button type="button" onClick={() => tratar(() => nuvem.usuarios.atualizar(u.id, { ativo: !u.ativo }), u.ativo ? 'Usuário desativado.' : 'Usuário reativado.')} className={acao}>
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const s = window.prompt(`Nova senha para ${u.nome} (mínimo 10 caracteres):`);
                            if (s) tratar(() => nuvem.usuarios.atualizar(u.id, { senha: s }), 'Senha redefinida.');
                          }}
                          className={acao}
                        >
                          Redefinir senha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              className="space-y-3 border-t border-linha pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                tratar(() => nuvem.usuarios.criar(novo), 'Usuário criado.').then(() => setNovo({ nome: '', email: '', senha: '', papel: 'assessor' }));
              }}
            >
              <h3 className="font-medium text-tinta">Novo usuário</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <input aria-label="Nome" placeholder="Nome" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={campo} />
                <input aria-label="E-mail" type="email" placeholder="E-mail" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={campo} />
                <input aria-label="Senha inicial" type="password" autoComplete="new-password" placeholder="Senha inicial (10 ou mais caracteres)" required value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} className={campo} />
                <select aria-label="Papel" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as 'admin' | 'assessor' })} className={campoSelect}>
                  <option value="assessor">Assessor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Botao type="submit" variante="primario">
                Criar usuário
              </Botao>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};
