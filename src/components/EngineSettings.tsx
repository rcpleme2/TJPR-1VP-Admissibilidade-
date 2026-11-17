import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { listarModelos, type ConfigServidor } from '../lib/api';
import type { ConfigMotor } from '../lib/storage';
import type { Provedor } from '../types/admissibility';
import { Ajuda, Botao, campo, Rotulo } from './ui';
import { DESCRICAO_NIVEL, FAMILIA_NIVEL, NIVEIS, nivelDoValor, ROTULO_NIVEL, valorNivel, type Nivel } from '../../shared/modelos';

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
  const nivelAtual = nivelDoValor(config.model[p]) ?? 'intermediario';
  const resolvidos = config.niveis?.[p];
  const modeloDo = (n: Nivel) => resolvidos?.[n]?.id ?? servidor?.modelosReserva?.[p]?.[n];

  const conferir = async () => {
    setConsulta({ carregando: true });
    try {
      const r = await listarModelos(p, usandoServidor ? undefined : chaves[p]);
      onConfig({ ...config, modelosDisponiveis: { ...config.modelosDisponiveis, [p]: r.modelos }, niveis: { ...config.niveis, [p]: r.niveis } });
      const daLista = NIVEIS.filter((n) => r.niveis?.[n]?.origem === 'lista').length;
      setConsulta({
        carregando: false,
        ok: daLista === 3 ? 'Modelos conferidos: os três níveis estão disponíveis para esta chave.' : 'Conferido. Onde a chave não lista um modelo da família, vale o modelo de reserva.',
      });
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

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-tinta-2">Nível do modelo</legend>
        <div className="space-y-1.5">
          {NIVEIS.map((n) => {
            const ativo = nivelAtual === n;
            const id = modeloDo(n);
            return (
              <label
                key={n}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 transition-colors ${ativo ? 'border-toga bg-toga-claro' : 'border-linha-forte bg-folha hover:border-tinta-3'}`}
              >
                <input type="radio" name={`nivel-${p}`} className="mt-1" checked={ativo} onChange={() => onConfig({ ...config, model: { ...config.model, [p]: valorNivel(n) } })} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-sm font-semibold ${ativo ? 'text-toga' : 'text-tinta'}`}>{ROTULO_NIVEL[n]}</span>
                    <span className="text-[13px] text-tinta-2">
                      {info.nome} {FAMILIA_NIVEL[p][n]}
                    </span>
                    {id && <span className="num truncate text-[12px] text-tinta-3">{id}</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-tinta-3">{DESCRICAO_NIVEL[n]}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Botao tamanho="sm" onClick={conferir} disabled={!pronto || consulta.carregando} title={pronto ? 'Conferir quais modelos a chave pode usar' : 'Informe a chave primeiro'}>
            {consulta.carregando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Conferir com a chave
          </Botao>
        </div>
        {consulta.erro ? (
          <Ajuda className="text-obice">{consulta.erro}</Ajuda>
        ) : consulta.ok ? (
          <Ajuda>{consulta.ok}</Ajuda>
        ) : (
          <Ajuda>Na análise, o sistema usa o modelo mais recente da família escolhida que a sua chave permite. A escolha fica salva neste navegador.</Ajuda>
        )}
      </fieldset>

      <p className="text-[13px] leading-snug text-tinta-3">A chave só é repassada à {info.empresa} na análise e na consulta de modelos; não é gravada nem registrada.</p>
    </div>
  );
};

export const nomeMotor = (p: Provedor) => MOTORES.find((m) => m.id === p)!;
