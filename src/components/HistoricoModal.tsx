import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { EntradaHistorico } from '../../shared/registro';
import { nuvem } from '../lib/nuvem';
import { Botao, dataHora, Modal } from './ui';

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
  }, [casoId]);

  return (
    <Modal titulo="Histórico de versões" subtitulo="Restaurar cria uma nova versão; nada é apagado. São mantidas as últimas 50." onClose={onClose} largura="max-w-xl">
      <div className="text-sm">
        {erro && <p className="text-obice">{erro}</p>}
        {!lista && !erro && <p className="text-tinta-3">Carregando…</p>}
        <ol className="divide-y divide-linha">
          {lista?.map((h) => (
            <li key={h.versao} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="num">
                  <span className="font-medium text-tinta">Versão {h.versao}</span>
                  {h.versao === versaoAtual && <span className="ml-2 text-[13px] text-ok">atual</span>}
                </p>
                <p className="num text-[13px] text-tinta-3">
                  {h.por.nome}, {dataHora(h.em)}
                </p>
                {h.resumo.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[13px] text-tinta-2">
                    {h.resumo.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              {h.versao !== versaoAtual && (
                <Botao tamanho="sm" variante="discreto" onClick={() => onRestaurar(h.versao)}>
                  <RotateCcw className="size-3.5" /> Restaurar
                </Botao>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
};
