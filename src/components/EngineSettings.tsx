import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { listarModelos, type ConfigServidor } from '../lib/api';
import type { ConfigMotor } from '../lib/storage';
import type { Provedor } from '../types/admissibility';
import { Ajuda, Botao, campo, campoSelect, Rotulo } from './ui';

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
  const [consulta, setConsulta] = useState<{ carregando: boolean; erro?: string; ok?: string }>({ carregando: false });
  const lista = config.modelosDisponiveis[p] ?? [];
  const escolhido = config.model[p];
  const padrao = servidor?.modelosPadrao[p];

  const atualizarLista = async () => {
    setConsulta({ carregando: true });
    try {
      const modelos = await listarModelos(p, usandoServidor ? undefined : chaves[p]);
      onConfig({ ...config, modelosDisponiveis: { ...config.modelosDisponiveis, [p]: modelos } });
      setConsulta({ carregando: false, ok: modelos.length ? `${modelos.length} modelos disponíveis para esta chave.` : 'Nenhum modelo de texto encontrado para esta chave.' });
    } catch (e) {
      setConsulta({ carregando: false, erro: (e as Error).message });
    }
  };

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
        <Rotulo htmlFor="modelo">Modelo</Rotulo>
        <div className="flex gap-2">
          <select
            id="modelo"
            value={escolhido}
            onChange={(e) => onConfig({ ...config, model: { ...config.model, [p]: e.target.value } })}
            className={`${campoSelect} min-w-0 flex-1`}
          >
            <option value="">Padrão do sistema{padrao ? ` (${padrao})` : ''}</option>
            {escolhido && !lista.some((m) => m.id === escolhido) && <option value={escolhido}>{escolhido}</option>}
            {lista.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome !== m.id ? `${m.nome} (${m.id})` : m.id}
              </option>
            ))}
          </select>
          <Botao onClick={atualizarLista} disabled={!pronto || consulta.carregando} title={pronto ? 'Consultar os modelos disponíveis para a chave' : 'Informe a chave primeiro'} className="shrink-0">
            {consulta.carregando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Atualizar lista
          </Botao>
        </div>
        {consulta.erro ? (
          <Ajuda className="text-obice">{consulta.erro}</Ajuda>
        ) : consulta.ok ? (
          <Ajuda>{consulta.ok}</Ajuda>
        ) : (
          <Ajuda>{lista.length ? 'A escolha fica salva neste navegador.' : 'Use “Atualizar lista” para ver os modelos que a sua chave permite usar.'}</Ajuda>
        )}
      </div>

      <p className="text-[13px] leading-snug text-tinta-3">A chave só é repassada à {info.empresa} na análise e na consulta de modelos; não é gravada nem registrada.</p>
    </div>
  );
};

export const nomeMotor = (p: Provedor) => MOTORES.find((m) => m.id === p)!;
