import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { EntradaHistorico } from '../../shared/registro';
import { nuvem } from '../lib/nuvem';

interface Props {
  casoId: string;
  versaoAtual: number;
  onClose: () => void;
  onRestaurar: (versao: number) => void;
}

export const HistoricoModal: React.FC<Props> = ({ casoId, versaoAtual, onClose, onRestaurar }) => {
  const [lista, setLista] = useState<EntradaHistorico[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    nuvem.casos.historico(casoId).then(setLista).catch((e) => setErro(e.message));
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [casoId, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hist-titulo" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-slate-300">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white">
          <h3 id="hist-titulo" className="text-sm font-bold text-slate-900">Histórico de versões</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-slate-500 hover:text-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-2 text-xs">
          {erro && <p className="text-rose-800">{erro}</p>}
          {!lista && !erro && <p className="text-slate-500">Carregando…</p>}
          {lista?.map((h) => (
            <div key={h.versao} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  v{h.versao} {h.versao === versaoAtual && <span className="text-emerald-700 font-medium">(atual)</span>}
                </p>
                <p className="text-slate-500">{h.por.nome} · {new Date(h.em).toLocaleString('pt-BR')}</p>
                <ul className="list-disc pl-4 mt-1 text-slate-700">
                  {h.resumo.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              {h.versao !== versaoAtual && (
                <button onClick={() => onRestaurar(h.versao)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 shrink-0">
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                </button>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">Restaurar cria uma nova versão com os dados daquela versão; nada é apagado. São mantidas as últimas 50 versões.</p>
        </div>
      </div>
    </div>
  );
};
