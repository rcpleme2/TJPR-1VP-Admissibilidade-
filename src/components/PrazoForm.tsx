import React, { useState } from 'react';
import { CalendarDays, Plus, X } from 'lucide-react';
import type { EntradasPrazo } from '../types/admissibility';

interface Props {
  value: EntradasPrazo;
  onChange: (v: EntradasPrazo) => void;
  /** Mostra o campo de embargos mesmo que o usuário ainda não saiba se houve. */
  idPrefix?: string;
}

export const ENTRADAS_VAZIAS: EntradasPrazo = { feriadosRespondido: false, feriados: [], interposicaoManual: {}, protocolos: [] };

export const PrazoForm: React.FC<Props> = ({ value, onChange, idPrefix = 'pz' }) => {
  const [escolha, setEscolha] = useState<'nao' | 'sim' | null>(value.feriadosRespondido ? (value.feriados.length > 0 ? 'sim' : 'nao') : null);
  const [novaData, setNovaData] = useState('');
  const [novaDesc, setNovaDesc] = useState('');
  const set = (p: Partial<EntradasPrazo>) => onChange({ ...value, ...p });

  const escolher = (e: 'nao' | 'sim') => {
    setEscolha(e);
    if (e === 'nao') set({ feriadosRespondido: true, feriados: [] });
    else set({ feriadosRespondido: value.feriados.length > 0 });
  };
  const adicionar = () => {
    if (!novaData || value.feriados.some((f) => f.data === novaData)) return;
    set({ feriadosRespondido: true, feriados: [...value.feriados, { data: novaData, descricao: novaDesc.trim() || undefined }].sort((a, b) => a.data.localeCompare(b.data)) });
    setNovaData('');
    setNovaDesc('');
  };

  const campo = 'w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-slate-500';
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-2">
        <CalendarDays className="w-4 h-4 text-slate-500" /> Datas e prazos
      </legend>

      <div>
        <label htmlFor={`${idPrefix}-ac`} className="block text-xs font-medium text-slate-600 mb-1">
          Data da intimação/publicação do acórdão <span className="text-rose-600">*</span>
        </label>
        <input id={`${idPrefix}-ac`} type="date" value={value.dataIntimacaoAcordao ?? ''} onChange={(e) => set({ dataIntimacaoAcordao: e.target.value || undefined })} className={campo} />
        <p className="text-[11px] text-slate-500 mt-1">O prazo de 15 dias úteis começa no 1º dia útil seguinte a esta data.</p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-emb`} className="block text-xs font-medium text-slate-600 mb-1">
          Data da intimação/publicação do acórdão dos embargos <span className="text-slate-400">(se houve)</span>
        </label>
        <input id={`${idPrefix}-emb`} type="date" value={value.dataIntimacaoEmbargos ?? ''} onChange={(e) => set({ dataIntimacaoEmbargos: e.target.value || undefined })} className={campo} />
      </div>

      <div role="group" aria-labelledby={`${idPrefix}-fer`}>
        <p id={`${idPrefix}-fer`} className="text-xs font-medium text-slate-600 mb-1">
          Há feriado local, suspensão de expediente ou indisponibilidade do sistema no período? <span className="text-rose-600">*</span>
        </p>
        <div className="flex gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`${idPrefix}-fer`} checked={escolha === 'nao'} onChange={() => escolher('nao')} /> Não há
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name={`${idPrefix}-fer`} checked={escolha === 'sim'} onChange={() => escolher('sim')} /> Sim, informar
          </label>
        </div>

        {escolha === 'sim' && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input aria-label="Data do feriado ou suspensão" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="bg-slate-50 text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
              <input aria-label="Descrição" value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="ex.: Portaria 123/2026" className="flex-1 min-w-0 bg-slate-50 text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
              <button type="button" onClick={adicionar} aria-label="Adicionar data" className="px-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Cada data informada deixa de contar como dia útil. Para um período, adicione cada dia.</p>
            <ul className="flex flex-wrap gap-1.5">
              {value.feriados.map((f) => (
                <li key={f.data} className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-full pl-2 pr-1 py-0.5">
                  {f.data.split('-').reverse().join('/')}
                  {f.descricao ? ` – ${f.descricao}` : ''}
                  <button type="button" aria-label={`Remover ${f.data}`} onClick={() => set({ feriados: value.feriados.filter((x) => x.data !== f.data), feriadosRespondido: value.feriados.length > 1 })}>
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-1">Já são considerados automaticamente: feriados nacionais, de Curitiba, Carnaval, Semana Santa, Corpus Christi e o recesso de 20/12 a 20/01.</p>
      </div>

      <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
        A <strong>data de interposição</strong> é lida do carimbo de protocolo do PDF do recurso. Você poderá conferir e corrigir depois da análise.
      </p>
    </fieldset>
  );
};
