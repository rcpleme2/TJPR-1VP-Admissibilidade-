import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Modal } from './ui';

/** Mostra o PDF anexado no visualizador do próprio navegador, sem enviá-lo a lugar algum. */
export const PreviewModal: React.FC<{ arquivo: File; onClose: () => void }> = ({ arquivo, onClose }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);

  return (
    <Modal
      titulo={arquivo.name}
      subtitulo={
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-toga underline-offset-2 hover:underline">
            Abrir em outra aba <ExternalLink className="size-3" />
          </a>
        ) : undefined
      }
      onClose={onClose}
      largura="max-w-5xl"
    >
      {url && <iframe src={url} title={`Visualização de ${arquivo.name}`} className="h-[72vh] w-full rounded-md border border-linha bg-papel" />}
    </Modal>
  );
};
