import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Trash2 } from 'lucide-react';
import { estimarTokensPdf, estimarTokensTexto } from '../../shared/textoPdf';
import type { UploadedFileItem } from '../types/admissibility';

interface Props {
  file: UploadedFileItem;
  papeis: Array<{ v: UploadedFileItem['role']; r: string }>;
  onUpdateRole: (id: string, role: UploadedFileItem['role']) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<UploadedFileItem>) => void;
}

const tamanho = (b: number) => (b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
const mil = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' mil' : String(n));

export const ArquivoCard: React.FC<Props> = ({ file, papeis, onUpdateRole, onRemove, onUpdate }) => {
  const [aberto, setAberto] = useState(false);
  const tokTexto = file.caracteres ? estimarTokensTexto(file.caracteres) : 0;
  const tokPdf = file.paginas ? estimarTokensPdf(file.paginas) : 0;
  const economia = tokPdf > 0 && tokTexto > 0 ? Math.max(0, Math.round((1 - tokTexto / tokPdf) * 100)) : 0;

  return (
    <div className="rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs">
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            {file.extraindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
            <p className="text-[11px] text-slate-500">
              {tamanho(file.size)}
              {file.extraindo && ' · extraindo texto…'}
              {!file.extraindo && file.paginas ? ` · ${file.paginas} pág.` : ''}
              {!file.extraindo && file.modo === 'texto' && tokTexto > 0 && ` · ≈ ${mil(tokTexto)} tokens como texto (PDF: ≈ ${mil(tokPdf)}${economia ? `, economia ≈ ${economia}%` : ''})`}
              {!file.extraindo && file.modo === 'pdf' && tokPdf > 0 && ` · enviado como PDF (≈ ${mil(tokPdf)} tokens)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label={`Papel de ${file.name}`}
            value={file.role}
            onChange={(e) => onUpdateRole(file.id, e.target.value as UploadedFileItem['role'])}
            className="bg-slate-50 text-[11px] text-slate-700 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-500"
          >
            {papeis.map((p) => (
              <option key={p.v} value={p.v}>
                {p.r}
              </option>
            ))}
          </select>
          {file.textPreview && (
            <button
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-label="Ver e editar o texto extraído"
              className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              title="Ver/editar o texto extraído"
            >
              {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => onRemove(file.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition" aria-label="Remover arquivo" title="Remover arquivo">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {file.avisoExtracao && <p className="px-3 pb-2 text-[11px] text-amber-800">{file.avisoExtracao}</p>}
      {file.protocolo && (
        <p className="px-3 pb-2 text-[11px] text-emerald-800">
          Protocolo detectado no PDF: <strong>{file.protocolo.data}</strong> (p. {file.protocolo.pagina})
        </p>
      )}

      {!file.extraindo && file.arquivo && (
        <div className="px-3 pb-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={file.modo === 'pdf'}
              disabled={false}
              onChange={(e) => onUpdate(file.id, { modo: e.target.checked || !file.textPreview ? 'pdf' : 'texto' })}
            />
            Enviar o PDF original (mais tokens; use para escaneados ou se o texto saiu truncado)
          </label>
        </div>
      )}

      {aberto && file.textPreview !== undefined && (
        <div className="px-3 pb-3">
          <label htmlFor={`txt-${file.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
            Texto que será enviado (Markdown). Edite para corrigir a extração ou tarjar dados pessoais:
          </label>
          <textarea
            id={`txt-${file.id}`}
            value={file.textPreview}
            rows={12}
            onChange={(e) => onUpdate(file.id, { textPreview: e.target.value, caracteres: e.target.value.length })}
            className="w-full text-[11px] font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-lg p-2 outline-none focus:border-slate-500"
          />
        </div>
      )}
    </div>
  );
};
