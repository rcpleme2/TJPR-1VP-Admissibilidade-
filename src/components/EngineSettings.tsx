import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ConfigServidor } from '../lib/api';
import type { ConfigMotor } from '../lib/storage';
import type { Provedor } from '../types/admissibility';
import { Ajuda, campo, Rotulo } from './ui';

interface Props {
  config: ConfigMotor;
  onConfig: (c: ConfigMotor) => void;
  chaves: Partial<Record<Provedor, string>>;
  onChaves: (c: Partial<Record<Provedor, string>>) => void;
  servidor: ConfigServidor | null;
}

const MOTORES: Array<{ id: Provedor; nome: string; empresa: string; onde: string }> = [
  { id: 'gemini', nome: 'Gemini', empresa: 'Google', onde: 'aistudio.google.com/apikey' },
  { id: 'claude', nome: 'Claude', empresa: 'Anthropic', onde: 'console.anthropic.com' },
  { id: 'gpt', nome: 'GPT', empresa: 'OpenAI', onde: 'platform.openai.com/api-keys' },
];

export const EngineSettings: React.FC<Props> = ({ config, onConfig, chaves, onChaves, servidor }) => {
  const [mostrar, setMostrar] = useState(false);
  const p = config.provider;
  const info = MOTORES.find((m) => m.id === p)!;
  const temChaveNoServidor = Boolean(servidor?.serverKeys.includes(p));
  const usandoServidor = temChaveNoServidor && config.usarChaveDoServidor;
  const pronto = usandoServidor || Boolean(chaves[p]);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-tinta-2">Motor de IA</p>
        <div role="radiogroup" aria-label="Motor de IA" className="grid grid-cols-3 rounded-md border border-linha-forte p-0.5">
          {MOTORES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={p === m.id}
              onClick={() => onConfig({ ...config, provider: m.id })}
              className={`h-8 rounded-[5px] text-sm transition-colors ${p === m.id ? 'bg-toga font-medium text-white' : 'text-tinta-2 hover:text-tinta'}`}
            >
              {m.nome}
            </button>
          ))}
        </div>
      </div>

      {temChaveNoServidor && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-tinta-2">
          <input type="checkbox" checked={config.usarChaveDoServidor} onChange={(e) => onConfig({ ...config, usarChaveDoServidor: e.target.checked })} />
          Usar a chave do servidor
        </label>
      )}

      {!usandoServidor && (
        <div>
          <Rotulo htmlFor="api-key">Chave de API da {info.empresa}</Rotulo>
          <div className="relative">
            <input
              id="api-key"
              type={mostrar ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={chaves[p] ?? ''}
              onChange={(e) => onChaves({ ...chaves, [p]: e.target.value.trim() })}
              placeholder={info.onde}
              className={`${campo} pr-9`}
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? 'Ocultar chave' : 'Mostrar chave'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-tinta-3 hover:text-tinta"
            >
              {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-tinta-2">
            <input type="checkbox" checked={config.lembrarChaves} onChange={(e) => onConfig({ ...config, lembrarChaves: e.target.checked })} />
            Lembrar neste navegador
          </label>
        </div>
      )}

      <div>
        <Rotulo htmlFor="modelo" dica="opcional">
          Modelo
        </Rotulo>
        <input
          id="modelo"
          type="text"
          value={config.model[p]}
          onChange={(e) => onConfig({ ...config, model: { ...config.model, [p]: e.target.value.trim() } })}
          placeholder={servidor?.modelosPadrao[p] ?? 'modelo padrão'}
          className={campo}
        />
        <Ajuda>{pronto ? 'Pronto para analisar.' : 'Sem chave: informe uma para poder analisar.'} A chave só é repassada à {info.empresa} na análise; não é gravada nem registrada.</Ajuda>
      </div>
    </div>
  );
};

export const nomeMotor = (p: Provedor) => MOTORES.find((m) => m.id === p)!;
