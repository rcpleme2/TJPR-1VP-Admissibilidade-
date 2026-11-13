import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { AdmissibilityAnalysisResult } from '../types/admissibility';
import { downloadAdmissibilityPDF } from '../utils/pdfGenerator';
import { Botao, campo, Modal, Rotulo } from './ui';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AdmissibilityAnalysisResult;
  responsavel?: string;
}

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ isOpen, onClose, data, responsavel }) => {
  const [includeMinuta, setIncludeMinuta] = useState(true);
  const [includeQuadro, setIncludeQuadro] = useState(true);
  const [assessorName, setAssessorName] = useState(responsavel || '');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        downloadAdmissibilityPDF(data, undefined, { includeMinuta, includeQuadro, assessorName });
      } finally {
        setIsGenerating(false);
        onClose();
      }
    }, 200);
  };

  return (
    <Modal
      titulo="Exportar nota técnica"
      subtitulo={<span className="num">{data.processo.numero || 'Processo sem número'}</span>}
      onClose={onClose}
      rodape={
        <>
          <Botao variante="discreto" onClick={onClose}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={handleDownload} disabled={isGenerating}>
            <Download className="size-4" />
            {isGenerating ? 'Gerando…' : 'Baixar PDF'}
          </Botao>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <p className="text-tinta-2">Nota técnica com a preliminar de sobrestamento, os pressupostos, o exame de cada recurso e a proposta.</p>
        <div>
          <Rotulo htmlFor="assessor">Assina a nota</Rotulo>
          <input id="assessor" type="text" value={assessorName} onChange={(e) => setAssessorName(e.target.value)} className={campo} />
        </div>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-tinta">
            <input type="checkbox" checked={includeMinuta} onChange={(e) => setIncludeMinuta(e.target.checked)} />
            Anexar a minuta da decisão
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-tinta">
            <input type="checkbox" checked={includeQuadro} onChange={(e) => setIncludeQuadro(e.target.checked)} />
            Anexar o quadro de requisitos por recurso
          </label>
        </div>
      </div>
    </Modal>
  );
};
