import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { EntradasPrazo } from '../types/admissibility';
import { Ajuda, Botao, campo, Rotulo } from './ui';

interface Props {
  value: EntradasPrazo;
  onChange: (v: EntradasPrazo) => void;
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

  const opcao = (ativa: boolean) =>
    `flex-1 h-9 rounded-md border text-sm transition-colors ${ativa ? 'border-toga bg-toga-claro font-medium text-toga' : 'border-linha-forte bg-folha text-tinta-2 hover:border-tinta-3'}`;

  return (
    <div className="space-y-4">
      <div>
        <Rotulo htmlFor={`${idPrefix}-ac`}>Intimação do acórdão</Rotulo>
        <input id={`${idPrefix}-ac`} type="date" required value={value.dataIntimacaoAcordao ?? ''} onChange={(e) => set({ dataIntimacaoAcordao: e.target.value || undefined })} className={`${campo} num`} />
        <Ajuda>Os 15 dias úteis contam a partir do dia útil seguinte.</Ajuda>
      </div>

      <div>
        <Rotulo htmlFor={`${idPrefix}-emb`} dica="se houve">
          Intimação do acórdão dos embargos
        </Rotulo>
        <input id={`${idPrefix}-emb`} type="date" value={value.dataIntimacaoEmbargos ?? ''} onChange={(e) => set({ dataIntimacaoEmbargos: e.target.value || undefined })} className={`${campo} num`} />
      </div>

      <div role="radiogroup" aria-labelledby={`${idPrefix}-fer`}>
        <p id={`${idPrefix}-fer`} className="mb-1.5 text-[13px] font-medium text-tinta-2">
          Feriado local, suspensão ou indisponibilidade no período?
        </p>
        <div className="flex gap-2">
          <button type="button" role="radio" aria-checked={escolha === 'nao'} onClick={() => escolher('nao')} className={opcao(escolha === 'nao')}>
            Não houve
          </button>
          <button type="button" role="radio" aria-checked={escolha === 'sim'} onClick={() => escolher('sim')} className={opcao(escolha === 'sim')}>
            Houve
          </button>
        </div>

        {escolha === 'sim' && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input aria-label="Data do feriado ou suspensão" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className={`${campo} num w-[9.5rem] shrink-0`} />
              <input aria-label="Descrição" value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Portaria, decreto…" className={`${campo} min-w-0`} />
              <Botao onClick={adicionar} aria-label="Adicionar data" className="shrink-0 px-2.5">
                <Plus className="size-4" />
              </Botao>
            </div>
            {value.feriados.length > 0 && (
              <ul className="space-y-1">
                {value.feriados.map((f) => (
                  <li key={f.data} className="flex items-center justify-between gap-2 text-sm text-tinta-2">
                    <span>
                      <span className="num font-medium text-tinta">{f.data.split('-').reverse().join('/')}</span>
                      {f.descricao ? `, ${f.descricao}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${f.data}`}
                      onClick={() => set({ feriados: value.feriados.filter((x) => x.data !== f.data), feriadosRespondido: value.feriados.length > 1 })}
                      className="rounded p-1 text-tinta-3 hover:text-obice"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Ajuda className="mt-0">Cada data deixa de contar como dia útil. Para um período, adicione cada dia.</Ajuda>
          </div>
        )}
        <Ajuda>Feriados nacionais e de Curitiba, Carnaval, Semana Santa, Corpus Christi e o recesso de 20/12 a 20/01 já são considerados.</Ajuda>
      </div>
    </div>
  );
};
