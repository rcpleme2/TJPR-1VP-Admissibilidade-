import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import { ErroApi, nuvem, type UsuarioNuvem } from '../lib/nuvem';

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

  const campo = 'w-full bg-slate-50 text-sm text-slate-800 border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-slate-600';
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Admissibilidade Recursal</h1>
            <p className="text-xs text-slate-500">TJPR • 1ª Vice-Presidência</p>
          </div>
        </div>
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
          <input id="login-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="login-senha" className="block text-xs font-medium text-slate-600 mb-1">Senha</label>
          <input id="login-senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
        </div>
        {erro && (
          <p role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
        <button disabled={enviando} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-60">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-[11px] text-slate-500">Acesso restrito. Os registros guardam apenas os dados extraídos e cadastrados, nunca os arquivos anexados.</p>
      </form>
    </div>
  );
};
