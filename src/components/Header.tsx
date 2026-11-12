import React from 'react';
import { Scale, BookOpen, Sparkles, RefreshCw, FileText, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenGuide: () => void;
  onLoadSample: () => void;
  onReset: () => void;
  hasResult: boolean;
  onDownloadPDF?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGuide,
  onLoadSample,
  onReset,
  hasResult,
  onDownloadPDF,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Scale className="w-6 h-6 text-slate-100" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  TJPR • 1ª Vice-Presidência
                </span>
                <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <span>Marco Lei 15.484/2026</span>
                </span>
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Proteção Anti-Injection</span>
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                Admissibilidade de Recursos Especiais e Extraordinários
              </h1>
              <p className="text-xs text-slate-500">
                Triagem técnica preliminar, conformidade da relevância e emissão de parecer (CPC, art. 1.030)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition shadow-xs"
              title="Consultar diretrizes técnicas da 1ª Vice-Presidência"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Orientações Técnicas</span>
            </button>

            <button
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-300 transition shadow-xs"
              title="Carregar caso simulado com REsp e RE"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Carregar Exemplo</span>
            </button>

            {hasResult && onDownloadPDF && (
              <button
                onClick={onDownloadPDF}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Baixar PDF</span>
              </button>
            )}

            {hasResult && (
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition"
                title="Reiniciar análise e carregar novos arquivos"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Novo Caso</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
