import React, { useState } from 'react';
import { ErroApi, nuvem, type UsuarioNuvem } from '../lib/nuvem';
import { Botao, campo, Rotulo } from './ui';

export const LoginView: React.FC<{ onLogin: (u: UsuarioNuvem) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      onLogin(await nuvem.login(email.trim(), senha));
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[22rem]">
        <h1 className="font-serif text-[34px] font-semibold leading-none tracking-[-0.015em] text-toga">Admissibilidade</h1>
        <p className="mt-2.5 text-sm text-tinta-3">Recursos especiais e extraordinários, 1ª Vice-Presidência do TJPR</p>

        <form onSubmit={entrar} className="mt-8 space-y-4 rounded-lg border border-linha bg-folha p-6">
          <div>
            <Rotulo htmlFor="login-email">E-mail</Rotulo>
            <input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          </div>
          <div>
            <Rotulo htmlFor="login-senha">Senha</Rotulo>
            <input id="login-senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-obice">
              {erro}
            </p>
          )}
          <Botao type="submit" variante="primario" disabled={enviando} className="w-full">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Botao>
        </form>
        <p className="mt-4 text-[13px] text-tinta-3">Acesso restrito à equipe da Vice-Presidência.</p>
      </div>
    </main>
  );
};
