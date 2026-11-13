import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Scale,
  ShieldAlert,
  Pencil,
  FileDown,
} from 'lucide-react';
import { MinutaDecisao1VP } from '../types/admissibility';

interface DecisionDraftViewProps {
  minuta: MinutaDecisao1VP;
  isMista: boolean;
  onChange: (m: MinutaDecisao1VP) => void;
  onDownloadPDF: () => void;
  onDownloadWord: () => void;
}

const Texto: React.FC<{
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  className: string;
  label: string;
  rows?: number;
}> = ({ editing, value, onChange, className, label, rows = 6 }) =>
  editing ? (
    <textarea
      aria-label={label}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs text-slate-900 bg-amber-50/40 border border-amber-300 rounded-lg p-2.5 outline-none focus:border-slate-600 leading-relaxed"
    />
  ) : (
    <p className={className}>{value}</p>
  );

export const DecisionDraftView: React.FC<DecisionDraftViewProps> = ({
  minuta,
  isMista,
  onChange,
  onDownloadPDF,
  onDownloadWord,
}) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const set = (parcial: Partial<MinutaDecisao1VP>) => onChange({ ...minuta, ...parcial });
  const setCap = (i: number, parcial: Partial<MinutaDecisao1VP['capitulosFundamentacao'][number]>) =>
    set({ capitulosFundamentacao: minuta.capitulosFundamentacao.map((c, k) => (k === i ? { ...c, ...parcial } : c)) });

  const getFullDecisionText = () => {
    let full = `${minuta.cabecalho}\n\n`;
    full += `I. RELATÓRIO\n${minuta.relatorio}\n\n`;
    full += `II. FUNDAMENTAÇÃO\n`;
    minuta.capitulosFundamentacao.forEach((cap) => {
      full += `\n${cap.tituloCapitulo}\n${cap.conteudo}\n`;
      if (cap.recursoCabivel) {
        full += `[Recurso cabível deste capítulo: ${cap.recursoCabivel}]\n`;
      }
    });
    full += `\nIII. DISPOSITIVO\n${minuta.dispositivoFinal}\n\n`;
    full += `${minuta.advertenciaRecursual ?? ''}\n`;
    return full;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFullDecisionText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-slate-600" />
            Minuta da Decisão de Admissibilidade (1ª Vice-Presidência TJPR)
          </h3>
          <p className="text-xs text-slate-500">
            Estruturada em capítulos autônomos conforme as saídas do art. 1.030 do CPC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition ${
              editing ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{editing ? 'Concluir edição' : 'Editar minuta'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-emerald-800">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          <button
            onClick={onDownloadWord}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Word (.doc)</span>
          </button>

          <button
            onClick={onDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar PDF Completo</span>
          </button>
        </div>
      </div>

      <div role="note" className="max-w-4xl mx-auto text-center text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
        RASCUNHO GERADO COM AUXÍLIO DE IA — as alterações feitas aqui são salvas e seguem para o PDF/Word. Revise o texto e os precedentes antes de assinar.
      </div>

      {/* Decision Paper Canvas */}
      <div className="bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200 font-serif leading-relaxed space-y-6 max-w-4xl mx-auto">
        {/* Judicial Letterhead */}
        <div className="text-center pb-6 border-b border-slate-300">
          <p className="text-xs tracking-widest uppercase font-bold text-slate-600 font-sans">
            Poder Judiciário do Estado do Paraná
          </p>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 mt-0.5 font-sans">
            1ª Vice-Presidência
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 font-sans">
            Juízo de Admissibilidade de Recursos aos Tribunais Superiores (REsp / RE)
          </p>
        </div>

        {/* Process Header */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-sans space-y-1">
          <Texto editing={editing} label="Cabeçalho" rows={4} value={minuta.cabecalho} onChange={(v) => set({ cabecalho: v })} className="font-semibold text-slate-800 whitespace-pre-line" />
        </div>

        {/* Relatório */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans border-b border-slate-200 pb-1">
            I. RELATÓRIO
          </h4>
          <Texto editing={editing} label="Relatório" rows={10} value={minuta.relatorio} onChange={(v) => set({ relatorio: v })} className="text-xs text-slate-800 text-justify whitespace-pre-line leading-relaxed" />
        </div>

        {/* Capítulos da Fundamentação */}
        <div className="space-y-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans border-b border-slate-200 pb-1">
            II. FUNDAMENTAÇÃO EM CAPÍTULOS AUTÔNOMOS (CPC, ART. 1.030)
          </h4>

          {minuta.capitulosFundamentacao.map((cap, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-900 font-sans uppercase">
                  {cap.tituloCapitulo}
                </h5>
                <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {cap.incisoArt1030}
                </span>
              </div>
              <Texto editing={editing} label={`Conteúdo do capítulo ${idx + 1}`} rows={10} value={cap.conteudo} onChange={(v) => setCap(idx, { conteudo: v })} className="text-xs text-slate-800 text-justify whitespace-pre-line leading-relaxed" />
              {cap.recursoCabivel && (
                <div className="text-[11px] font-sans text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <strong>Recurso cabível deste capítulo:</strong> {cap.recursoCabivel}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dispositivo */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans border-b border-slate-200 pb-1">
            III. DISPOSITIVO
          </h4>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <Texto editing={editing} label="Dispositivo" rows={8} value={minuta.dispositivoFinal} onChange={(v) => set({ dispositivoFinal: v })} className="text-xs font-medium text-slate-900 text-justify whitespace-pre-line leading-relaxed" />
          </div>
        </div>

        {/* Advertência Recursal (Decisão Mista) */}
        <div className="p-4 bg-rose-50/70 border border-rose-300 rounded-xl space-y-1 font-sans">
          <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            <span>ADVERTÊNCIA RECURSAL OBRIGATÓRIA (SISTEMA DE DECISÃO MISTA)</span>
          </div>
          <Texto editing={editing} label="Advertência recursal" rows={8} value={minuta.advertenciaRecursual ?? ''} onChange={(v) => set({ advertenciaRecursual: v })} className="text-xs text-rose-950 text-justify whitespace-pre-line leading-relaxed font-sans" />
        </div>

        {/* Signature Placeholder */}
        <div className="pt-8 text-center font-sans space-y-1">
          <div className="w-64 h-px bg-slate-300 mx-auto"></div>
          <p className="text-xs font-bold text-slate-800">
            Desembargador 1º Vice-Presidente do Tribunal de Justiça do Estado do Paraná
          </p>
          <p className="text-[11px] text-slate-500">
            Competência delegada pela Presidência (RITJPR, art. 15, § 3º)
          </p>
        </div>
      </div>
    </div>
  );
};
