import React, { useEffect, useState } from 'react';
import {
  X,
  FileCheck,
  Download,
} from 'lucide-react';
import { AdmissibilityAnalysisResult } from '../types/admissibility';
import { downloadAdmissibilityPDF } from '../utils/pdfGenerator';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AdmissibilityAnalysisResult;
}

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ isOpen, onClose, data }) => {
  const [includeMinuta, setIncludeMinuta] = useState(true);
  const [includeAssessorNotes, setIncludeAssessorNotes] = useState(true);
  const [assessorName, setAssessorName] = useState('Assessor Jurídico - 1ª VP/TJPR');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        downloadAdmissibilityPDF(data, undefined, {
          includeMinuta,
          includeAssessorNotes,
          assessorName,
        });
      } finally {
        setIsGenerating(false);
        onClose();
      }
    }, 200);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pdf-titulo" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-200/80 text-slate-800">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="pdf-titulo" className="text-sm font-bold text-slate-900">Exportação do Relatório Oficial em PDF</h3>
              <p className="text-xs text-slate-500">Checklist da 1ª Vice-Presidência • TJPR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Autos: {data.processo.numero || 'Não informado'}</span>
              <span className="text-slate-600 font-mono text-[11px]">{data.recursosAnalisados.length} recurso(s)</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              O documento gerado atende ao checklist da Seção 11 das Orientações Técnicas, incluindo tabela completa de A
              a J, análise jurídica e fundamentos legais.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Assessor / Analista Responsável
              </label>
              <input
                type="text"
                value={assessorName}
                onChange={(e) => setAssessorName(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-slate-500"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMinuta}
                  onChange={(e) => setIncludeMinuta(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-slate-700 font-medium">
                  Incluir Minuta Completa da Decisão Judicial no final do PDF
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAssessorNotes}
                  onChange={(e) => setIncludeAssessorNotes(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-slate-700 font-medium">
                  Incluir Anotações e Ressalvas do Assessor na tabela do Checklist
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            Cancelar
          </button>

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
          >
            {isGenerating ? (
              <span>Gerando PDF...</span>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Relatório Oficial (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
