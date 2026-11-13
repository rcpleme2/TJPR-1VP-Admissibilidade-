import React, { useState } from 'react';
import { ChevronDown, FileText, Loader2, X } from 'lucide-react';
import { estimarTokensPdf, estimarTokensTexto } from '../../shared/textoPdf';
import { movimentoCompativel } from '../../shared/protocolo';
import type { UploadedFileItem } from '../types/admissibility';
import { campoArea } from './ui';

interface Props {
  file: UploadedFileItem;
  papeis: Array<{ v: UploadedFileItem['role']; r: string }>;
  onUpdateRole: (id: string, role: UploadedFileItem['role']) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<UploadedFileItem>) => void;
}

const tamanho = (b: number) => (b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB');
const mil = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : String(n));

export const ArquivoCard: React.FC<Props> = ({ file, papeis, onUpdateRole, onRemove, onUpdate }) => {
  const [aberto, setAberto] = useState(false);
  const tokTexto = file.caracteres ? estimarTokensTexto(file.caracteres) : 0;
  const tokPdf = file.paginas ? estimarTokensPdf(file.paginas) : 0;
  const economia = tokPdf > 0 && tokTexto > 0 ? Math.max(0, Math.round((1 - tokTexto / tokPdf) * 100)) : 0;
  const ehRecurso = file.role === 'recurso_especial' || file.role === 'recurso_extraordinario';
  const divergente = file.protocolo && ehRecurso && movimentoCompativel(file.role as 'recurso_especial' | 'recurso_extraordinario', file.protocolo.movimento) === false;

  const meta = [
    tamanho(file.size),
    file.extraindo ? 'lendo o texto…' : file.paginas ? `${file.paginas} páginas` : '',
    !file.extraindo && file.modo === 'texto' && tokTexto > 0 ? `≈ ${mil(tokTexto)} tokens${economia ? ` (${economia}% a menos que o PDF)` : ''}` : '',
    !file.extraindo && file.modo === 'pdf' && tokPdf > 0 ? `enviado como PDF, ≈ ${mil(tokPdf)} tokens` : '',
  ].filter(Boolean);

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-tinta-3">{file.extraindo ? <Loader2 className="size-[18px] animate-spin" /> : <FileText className="size-[18px]" />}</span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-tinta" title={file.name}>
            {file.name}
          </p>
          <p className="num mt-0.5 text-[13px] text-tinta-3">{meta.join(', ')}</p>

          {file.protocolo && (
            <p className="mt-1 text-[13px] text-ok">
              Protocolado em <span className="num font-medium">{file.protocolo.data}</span> (p. {file.protocolo.pagina}
              {file.protocolo.sistema === 'projudi' ? ', carimbo do Projudi' : ''})
              {file.protocolo.movimento && <span className="text-tinta-3">, {file.protocolo.movimento}</span>}
            </p>
          )}
          {file.protocolo?.referencia && <p className="text-[13px] text-tinta-3">{file.protocolo.referencia}</p>}
          {divergente && (
            <p className="mt-1 text-[13px] text-atencao">
              O carimbo diz “{file.protocolo!.movimento}”, mas o arquivo está como {file.role === 'recurso_especial' ? 'recurso especial' : 'recurso extraordinário'}. Confira a classificação.
            </p>
          )}
          {file.avisoExtracao && <p className="mt-1 text-[13px] text-atencao">{file.avisoExtracao}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <select
            aria-label={`Tipo de peça de ${file.name}`}
            value={file.role}
            onChange={(e) => onUpdateRole(file.id, e.target.value as UploadedFileItem['role'])}
            className="h-8 max-w-[11rem] rounded-md border border-transparent bg-transparent pl-2 pr-7 text-[13px] text-tinta-2 hover:border-linha-forte focus:border-toga focus:outline-none"
          >
            {papeis.map((p) => (
              <option key={p.v} value={p.v}>
                {p.r}
              </option>
            ))}
          </select>
          {file.textPreview !== undefined && (
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-label="Ver e editar o texto extraído"
              title="Texto extraído"
              className="rounded-md p-1.5 text-tinta-3 hover:bg-papel hover:text-tinta"
            >
              <ChevronDown className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button type="button" onClick={() => onRemove(file.id)} aria-label={`Remover ${file.name}`} title="Remover" className="rounded-md p-1.5 text-tinta-3 hover:bg-obice-fundo hover:text-obice">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {aberto && file.textPreview !== undefined && (
        <div className="ml-[30px] mt-3 space-y-2">
          <label htmlFor={`txt-${file.id}`} className="block text-[13px] text-tinta-3">
            Texto que será enviado. Edite para corrigir a extração ou tarjar dados pessoais.
          </label>
          <textarea
            id={`txt-${file.id}`}
            value={file.textPreview}
            rows={12}
            onChange={(e) => onUpdate(file.id, { textPreview: e.target.value, caracteres: e.target.value.length })}
            className={`${campoArea} font-serif text-[13px]`}
          />
          {file.arquivo && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-tinta-2">
              <input type="checkbox" checked={file.modo === 'pdf'} onChange={(e) => onUpdate(file.id, { modo: e.target.checked || !file.textPreview ? 'pdf' : 'texto' })} />
              Enviar o PDF original em vez do texto (use se a extração saiu truncada)
            </label>
          )}
        </div>
      )}
    </li>
  );
};
