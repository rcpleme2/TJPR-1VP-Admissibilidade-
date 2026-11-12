import React, { useState } from 'react';
import { Cpu, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import type { ConfigServidor } from '../lib/api';
import type { ConfigMotor } from '../lib/storage';
import type { Provedor } from '../types/admissibility';

interface Props {
  config: ConfigMotor;
  onConfig: (c: ConfigMotor) => void;
  chaves: Partial<Record<Provedor, string>>;
  onChaves: (c: Partial<Record<Provedor, string>>) => void;
  token: string;
  onToken: (t: string) => void;
  servidor: ConfigServidor | null;
}

const MOTORES: Array<{ id: Provedor; nome: string; empresa: string; onde: string }> = [
  { id: 'gemini', nome: 'Gemini', empresa: 'Google', onde: 'aistudio.google.com/apikey' },
  { id: 'claude', nome: 'Claude', empresa: 'Anthropic', onde: 'console.anthropic.com' },
  { id: 'gpt', nome: 'GPT', empresa: 'OpenAI', onde: 'platform.openai.com/api-keys' },
];

export const EngineSettings: React.FC<Props> = ({ config, onConfig, chaves, onChaves, token, onToken, servidor }) => {
  const [mostrar, setMostrar] = useState(false);
  const p = config.provider;
  const info = MOTORES.find((m) => m.id === p)!;
  const temChaveNoServidor = Boolean(servidor?.serverKeys.includes(p));
  const usandoServidor = temChaveNoServidor && config.usarChaveDoServidor;

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-2">
        <Cpu className="w-4 h-4 text-slate-500" />
        Motor de IA
      </legend>

      <div role="radiogroup" aria-label="Motor de IA" className="grid grid-cols-3 gap-1.5">
        {MOTORES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={p === m.id}
            onClick={() => onConfig({ ...config, provider: m.id })}
            className={`rounded-xl border px-2 py-2 text-center transition ${
              p === m.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="block text-xs font-semibold">{m.nome}</span>
            <span className={`block text-[11px] ${p === m.id ? 'text-slate-300' : 'text-slate-500'}`}>{m.empresa}</span>
          </button>
        ))}
      </div>

      {temChaveNoServidor && (
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={config.usarChaveDoServidor}
            onChange={(e) => onConfig({ ...config, usarChaveDoServidor: e.target.checked })}
          />
          Usar a chave configurada no servidor
        </label>
      )}

      {!usandoServidor && (
        <div>
          <label htmlFor="api-key" className="block text-xs font-medium text-slate-600 mb-1">
            Chave de API – {info.nome}
          </label>
          <div className="relative">
            <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="api-key"
              type={mostrar ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={chaves[p] ?? ''}
              onChange={(e) => onChaves({ ...chaves, [p]: e.target.value.trim() })}
              placeholder={`Cole a chave (${info.onde})`}
              className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl pl-8 pr-9 py-2 outline-none focus:border-slate-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? 'Ocultar chave' : 'Mostrar chave'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {mostrar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-600 mt-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.lembrarChaves}
              onChange={(e) => onConfig({ ...config, lembrarChaves: e.target.checked })}
            />
            Lembrar neste navegador (desmarcado: some ao fechar a aba)
          </label>
        </div>
      )}

      <div>
        <label htmlFor="modelo" className="block text-xs font-medium text-slate-600 mb-1">
          Modelo <span className="text-slate-400">(opcional)</span>
        </label>
        <input
          id="modelo"
          type="text"
          value={config.model[p]}
          onChange={(e) => onConfig({ ...config, model: { ...config.model, [p]: e.target.value.trim() } })}
          placeholder={servidor?.modelosPadrao[p] ?? 'modelo padrão'}
          className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-slate-500 font-mono"
        />
      </div>

      {servidor?.authRequired && (
        <div>
          <label htmlFor="token" className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Token de acesso da instalação
          </label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => onToken(e.target.value)}
            className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-slate-500 font-mono"
          />
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-relaxed">
        A chave é enviada ao servidor apenas para repassar à {info.empresa} nesta análise; não é gravada nem registrada em log.
        Os autos são enviados ao provedor escolhido.
      </p>
    </fieldset>
  );
};
