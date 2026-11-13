import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, History, Loader2 } from 'lucide-react';
import { STATUS_CASO, validarCNJ, type StatusCaso } from '../../shared/registro';

export type EstadoSalvamento = 'exemplo' | 'novo' | 'salvando' | 'salvo' | 'erro' | 'conflito' | 'numero_invalido';

interface Props {
  estado: EstadoSalvamento;
  numero: string;
  onNumero: (n: string) => void;
  versao?: number;
  atualizadoPor?: string;
  atualizadoEm?: string;
  status: StatusCaso;
  onStatus: (s: StatusCaso) => void;
  mensagem?: string;
  onRetry: () => void;
  onHistorico: () => void;
  conflito?: { versao: number; por: string; em: string };
  onCarregarNuvem: () => void;
  onSobrescrever: () => void;
}

const ROTULO_STATUS: Record<StatusCaso, string> = { em_analise: 'Em análise', revisado: 'Revisado', concluido: 'Concluído' };

export const SaveBar: React.FC<Props> = (p) => {
  const [numero, setNumero] = useState(p.numero);
  useEffect(() => setNumero(p.numero), [p.numero]);
  const cnj = validarCNJ(numero);

  const badge = {
    exemplo: <span className="text-slate-600">Caso de exemplo: não é gravado na nuvem</span>,
    novo: <span className="text-slate-600">Ainda não gravado</span>,
    salvando: (
      <span className="inline-flex items-center gap-1 text-slate-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…
      </span>
    ),
    salvo: (
      <span className="inline-flex items-center gap-1 text-emerald-800">
        <CheckCircle2 className="w-3.5 h-3.5" /> Salvo na nuvem · v{p.versao}
        {p.atualizadoPor ? ` · ${p.atualizadoPor}` : ''}
        {p.atualizadoEm ? ` · ${new Date(p.atualizadoEm).toLocaleString('pt-BR')}` : ''}
      </span>
    ),
    erro: (
      <span className="inline-flex items-center gap-1 text-rose-800">
        <CloudOff className="w-3.5 h-3.5" /> {p.mensagem || 'Não foi possível salvar.'}{' '}
        <button onClick={p.onRetry} className="underline">Tentar de novo</button>
      </span>
    ),
    conflito: <span className="inline-flex items-center gap-1 text-amber-900"><AlertTriangle className="w-3.5 h-3.5" /> Conflito de edição</span>,
    numero_invalido: <span className="inline-flex items-center gap-1 text-amber-900"><AlertTriangle className="w-3.5 h-3.5" /> {p.mensagem || 'Corrija o número do processo para gravar.'}</span>,
  }[p.estado];

  return (
    <div className="sticky top-0 z-30 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <label htmlFor="num-proc" className="font-medium text-slate-600">Processo</label>
          <input
            id="num-proc"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onBlur={() => numero !== p.numero && p.onNumero(numero.trim())}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-invalid={!cnj.valido}
            className={`font-mono text-xs bg-slate-50 border rounded-lg px-2 py-1 w-56 outline-none focus:border-slate-600 ${cnj.valido ? 'border-slate-300' : 'border-amber-400'}`}
          />
        </div>
        <div role="status" aria-live="polite">{badge}</div>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-slate-600">
          Situação
          <select value={p.status} onChange={(e) => p.onStatus(e.target.value as StatusCaso)} disabled={p.estado === 'exemplo'} className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs">
            {STATUS_CASO.map((s) => (
              <option key={s} value={s}>{ROTULO_STATUS[s]}</option>
            ))}
          </select>
        </label>
        <button onClick={p.onHistorico} disabled={p.estado === 'exemplo' || p.estado === 'novo'} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40">
          <History className="w-3.5 h-3.5" /> Histórico
        </button>
      </div>
      {!cnj.valido && p.estado !== 'exemplo' && <p className="text-[11px] text-amber-900">{cnj.motivo}</p>}
      {p.estado === 'conflito' && p.conflito && (
        <div role="alert" className="text-xs text-amber-950 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 space-y-2">
          <p>
            <strong>{p.conflito.por}</strong> gravou a versão {p.conflito.versao} deste registro em {new Date(p.conflito.em).toLocaleString('pt-BR')}, depois de você abri-lo. Suas alterações ainda não foram gravadas.
          </p>
          <div className="flex gap-2">
            <button onClick={p.onCarregarNuvem} className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold">Carregar a versão da nuvem (descarta minhas alterações)</button>
            <button onClick={p.onSobrescrever} className="px-2.5 py-1 rounded-lg border border-amber-500 bg-white font-semibold">Gravar a minha versão por cima</button>
          </div>
          <p className="text-[11px]">Nenhuma versão se perde: tudo fica no histórico e pode ser restaurado.</p>
        </div>
      )}
    </div>
  );
};
