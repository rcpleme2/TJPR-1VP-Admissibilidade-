import React from 'react';
import type { PreparoItem, SituacaoPreparo } from '../../shared/schema';
import { avisosPreparo, ROTULO_PREPARO } from '../../shared/preparo';
import { Folha, TituloSecao, type Tom } from './ui';

const TOM: Record<SituacaoPreparo, Tom> = {
  recolhido: 'ok',
  gratuidade: 'ok',
  isencao: 'ok',
  insuficiente: 'atencao',
  nao_comprovado: 'obice',
  a_verificar: 'neutro',
};
const COR: Record<Tom, string> = { ok: 'text-ok', atencao: 'text-atencao', obice: 'text-obice', neutro: 'text-tinta-2' };

const campo = 'h-8 w-full rounded-md border border-linha-forte bg-folha px-2 text-[13px] text-tinta focus:border-toga focus:outline-none';

export const PreparoPanel: React.FC<{ itens: PreparoItem[]; onChange: (i: PreparoItem[]) => void }> = ({ itens, onChange }) => {
  const set = (id: string, p: Partial<PreparoItem>) => onChange(itens.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const avisos = avisosPreparo(itens);

  return (
    <Folha aria-labelledby="preparo-titulo" className="p-6 sm:p-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <TituloSecao id="preparo-titulo">Preparo</TituloSecao>
        <p className="text-[13px] text-tinta-3">Custas e porte, ou dispensa por gratuidade ou isenção (CPC, art. 1.007)</p>
      </div>

      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-3">Nenhum recurso identificado.</p>
      ) : (
        <ul className="mt-4 divide-y divide-linha border-t border-linha">
          {itens.map((p) => (
            <li key={p.id} className="grid gap-3 py-4 md:grid-cols-[11rem_11rem_minmax(0,1fr)]">
              <div>
                <p className="text-sm font-medium text-tinta">{p.recurso}</p>
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[13px] text-tinta-2">
                  <input type="checkbox" checked={p.conferido} onChange={(e) => set(p.id, { conferido: e.target.checked })} />
                  Conferido
                </label>
              </div>
              <div>
                <label htmlFor={`prep-${p.id}`} className="sr-only">
                  Situação do preparo do {p.recurso}
                </label>
                <select
                  id={`prep-${p.id}`}
                  value={p.situacao}
                  onChange={(e) => set(p.id, { situacao: e.target.value as SituacaoPreparo })}
                  className={`${campo} pr-7 font-medium ${COR[TOM[p.situacao]]}`}
                >
                  {(Object.keys(ROTULO_PREPARO) as SituacaoPreparo[]).map((s) => (
                    <option key={s} value={s} className="text-tinta">
                      {ROTULO_PREPARO[s]}
                    </option>
                  ))}
                </select>
                {(p.situacao === 'recolhido' || p.situacao === 'insuficiente') && (
                  <input aria-label={`Valor recolhido no ${p.recurso}`} value={p.valorRecolhido ?? ''} onChange={(e) => set(p.id, { valorRecolhido: e.target.value })} placeholder="Valor recolhido" className={`${campo} num mt-1.5`} />
                )}
              </div>
              <div>
                <label htmlFor={`prep-f-${p.id}`} className="sr-only">
                  Comprovação do preparo do {p.recurso}
                </label>
                <textarea
                  id={`prep-f-${p.id}`}
                  rows={3}
                  value={p.fundamento}
                  onChange={(e) => set(p.id, { fundamento: e.target.value })}
                  placeholder={p.situacao === 'gratuidade' ? 'Decisão que deferiu a gratuidade (mov. e data)' : p.situacao === 'isencao' ? 'Fundamento da isenção' : 'Guia e comprovante (página)'}
                  className="w-full resize-y rounded-md border border-linha-forte bg-folha px-2.5 py-1.5 text-[13px] leading-snug text-tinta focus:border-toga focus:outline-none"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {avisos.length > 0 && (
        <div className="space-y-1.5 border-t border-linha pt-4">
          {avisos.map((a, i) => (
            <p key={i} className="flex gap-2.5 text-sm text-tinta-2">
              <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-[1.5px] bg-atencao" />
              {a}
            </p>
          ))}
        </div>
      )}
    </Folha>
  );
};
