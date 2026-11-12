import React, { useState } from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import type { EntradasPrazo, Verificacoes } from '../types/admissibility';
import { ENTRADAS_VAZIAS, PrazoForm } from './PrazoForm';

const ROTULO = {
  tempestivo: { t: 'Tempestivo', c: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  intempestivo: { t: 'Intempestivo', c: 'bg-rose-50 text-rose-800 border-rose-200' },
  tempestivo_se_prazo_dobro: { t: 'Só se prazo em dobro', c: 'bg-amber-50 text-amber-800 border-amber-200' },
  indeterminado: { t: 'Indeterminado', c: 'bg-slate-100 text-slate-700 border-slate-200' },
} as const;

interface Props {
  v: Verificacoes;
  entradas?: EntradasPrazo;
  onChange: (e: EntradasPrazo) => void;
}

const paraISO = (br: string | null) => (br ? br.split('/').reverse().join('-') : '');

export const DeadlinesPanel: React.FC<Props> = ({ v, entradas = ENTRADAS_VAZIAS, onChange }) => {
  const [aberto, setAberto] = useState(() => !entradas.feriadosRespondido || !entradas.dataIntimacaoAcordao);
  return (
  <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3" aria-labelledby="prazos-titulo">
    <div className="flex items-start gap-2">
      <CalendarClock className="w-4 h-4 text-slate-600 mt-0.5" />
      <div>
        <h3 id="prazos-titulo" className="text-sm font-bold text-slate-900">Tempestividade e marco da relevância (calculados pelo sistema)</h3>
        <p className="text-xs text-slate-500">
          Prazos recalculados em código a partir das datas extraídas (15 dias úteis, CPC arts. 219 e 1.003, § 5º; recesso de 20/12 a
          20/01). A IA não decide a tempestividade. Confira suspensões locais e feriados específicos.
        </p>
      </div>
    </div>

    <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2" open={aberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="text-xs font-semibold text-slate-700 cursor-pointer">Datas informadas, feriados e suspensões (editar e recalcular)</summary>
      <div className="mt-3 max-w-xl">
        <PrazoForm value={entradas} onChange={onChange} idPrefix="pos" />
      </div>
    </details>

    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-1.5 pr-3 font-medium">Recurso</th>
            <th className="pr-3 font-medium">Base da contagem</th>
            <th className="pr-3 font-medium">Último dia (15 d.u.)</th>
            <th className="pr-3 font-medium">Em dobro</th>
            <th className="pr-3 font-medium">Interposição</th>
            <th className="font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {v.prazos.map((p) => {
            const r = ROTULO[p.status];
            return (
              <tr key={p.recursoId} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 font-semibold text-slate-800">{p.recursoTipo}</td>
                <td className="pr-3 text-slate-700" title={p.baseDescricao}>
                  {p.dataBase ?? '—'}
                  <span className="block text-[11px] text-slate-500 max-w-[11rem]">{p.fonteBase}</span>
                </td>
                <td className="pr-3 text-slate-700">{p.dataLimite ?? '—'}</td>
                <td className="pr-3 text-slate-700">{p.dataLimiteDobro ?? '—'}</td>
                <td className="pr-3 text-slate-700">
                  <input
                    type="date"
                    aria-label={`Data de interposição do ${p.recursoTipo}`}
                    value={paraISO(p.dataInterposicao)}
                    onChange={(e) => {
                      const m = { ...entradas.interposicaoManual };
                      if (e.target.value) m[p.recursoId] = e.target.value;
                      else delete m[p.recursoId];
                      onChange({ ...entradas, interposicaoManual: m });
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-xs"
                  />
                  <span className="block text-[11px] text-slate-500 mt-0.5 max-w-[11rem]">{p.fonteInterposicao || 'não localizada'}</span>
                </td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${r.c}`}>{r.t}</span>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">{p.observacao}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <p className="text-xs text-slate-700">
      <strong>Relevância (REsp):</strong> {v.relevancia.observacao}
    </p>

    {v.avisos.length > 0 && (
      <ul className="space-y-1">
        {v.avisos.map((a, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {a}
          </li>
        ))}
      </ul>
    )}
  </section>
);
};
