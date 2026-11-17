import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EntradasPrazo, Verificacoes } from '../types/admissibility';
import { ENTRADAS_VAZIAS, PrazoForm } from './PrazoForm';
import { Folha, Marca, TituloSecao, type Tom } from './ui';

const ROTULO: Record<Verificacoes['prazos'][number]['status'], { t: string; tom: Tom }> = {
  tempestivo: { t: 'Tempestivo', tom: 'ok' },
  intempestivo: { t: 'Intempestivo', tom: 'obice' },
  tempestivo_se_prazo_dobro: { t: 'Só com prazo em dobro', tom: 'atencao' },
  indeterminado: { t: 'Indeterminado', tom: 'neutro' },
};

interface Props {
  v: Verificacoes;
  entradas?: EntradasPrazo;
  onChange: (e: EntradasPrazo) => void;
}

const paraISO = (br: string | null) => (br ? br.split('/').reverse().join('-') : '');

export const DeadlinesPanel: React.FC<Props> = ({ v, entradas = ENTRADAS_VAZIAS, onChange }) => {
  const [aberto, setAberto] = useState(() => !entradas.feriadosRespondido || !entradas.dataIntimacaoAcordao);

  return (
    <Folha aria-labelledby="prazos-titulo" className="p-6 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <TituloSecao id="prazos-titulo">Tempestividade</TituloSecao>
        <p className="text-[13px] text-tinta-3">Calculada pelo sistema, não pela IA: 15 dias úteis (CPC, arts. 219 e 1.003, § 5º)</p>
      </div>

      <div className="mt-5 -mx-6 overflow-x-auto px-6 sm:-mx-8 sm:px-8">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-linha text-left text-[13px] text-tinta-3">
              <th className="pb-2 pr-4 font-normal">Recurso</th>
              <th className="pb-2 pr-4 font-normal">Contagem desde</th>
              <th className="pb-2 pr-4 font-normal">Prazo final</th>
              <th className="pb-2 pr-4 font-normal">Interposição</th>
              <th className="pb-2 font-normal">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {v.prazos.map((p) => {
              const r = ROTULO[p.status];
              return (
                <tr key={p.recursoId} className="align-top">
                  <td className="py-3 pr-4 font-medium text-tinta">{p.recursoTipo}</td>
                  <td className="num py-3 pr-4 text-tinta" title={p.baseDescricao}>
                    {p.dataBase ?? '—'}
                    <span className="block max-w-[11rem] text-[13px] leading-snug text-tinta-3">{p.fonteBase}</span>
                  </td>
                  <td className="num py-3 pr-4 text-tinta">
                    {p.dataLimite ?? '—'}
                    {p.dataLimiteDobro && <span className="block text-[13px] text-tinta-3">em dobro: {p.dataLimiteDobro}</span>}
                  </td>
                  <td className="py-2 pr-4">
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
                      className="num h-8 rounded-md border border-linha-forte bg-folha px-2 text-sm text-tinta focus:border-toga focus:outline-none"
                    />
                    <span className="mt-1 block max-w-[11rem] text-[13px] leading-snug text-tinta-3">{p.fonteInterposicao || 'não localizada'}</span>
                  </td>
                  <td className="py-3">
                    <Marca tom={r.tom}>{r.t}</Marca>
                    {p.observacao && <p className="mt-1 max-w-xs text-[13px] leading-snug text-tinta-3">{p.observacao}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-2 border-t border-linha pt-5 text-sm">
        <p className="text-tinta-2">
          <span className="font-medium text-tinta">Relevância.</span> {v.relevancia.observacao}
        </p>
        {v.avisos.map((a, i) => (
          <p key={i} className="flex gap-2.5 text-tinta-2">
            <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-[1.5px] bg-atencao" />
            {a}
          </p>
        ))}
      </div>

      <details className="group mt-6 border-t border-linha pt-4" open={aberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-toga">
          Datas informadas e feriados
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 max-w-md">
          <PrazoForm value={entradas} onChange={onChange} idPrefix="pos" />
        </div>
      </details>
    </Folha>
  );
};
