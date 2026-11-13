import React, { useState } from 'react';
import { Loader2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { UploadedFileItem } from '../types/admissibility';
import { LIMITES } from '../../shared/schema';
import type { CasoResumo } from '../../shared/registro';
import { ArquivoCard } from './ArquivoCard';
import { extrairPdf } from '../lib/pdfText';
import { ROTULO_STATUS } from './CasoCabecalho';
import { Ajuda, Botao, campo, campoArea, campoSelect, dataHora, Folha, Rotulo, TituloSecao } from './ui';

/** Papel do arquivo a partir de palavras inteiras do nome (evita falsos positivos como "resposta" → REsp). */
export function detectarPapel(nome: string, padrao: UploadedFileItem['role']): UploadedFileItem['role'] {
  const tokens = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tem = (...ps: string[]) => ps.some((p) => tokens.includes(p));
  const colado = tokens.join('');
  if (/recursoextraordinario/.test(colado)) return 'recurso_extraordinario';
  if (/recursoespecial/.test(colado)) return 'recurso_especial';
  if (tem('acordao', 'sentenca')) return tem('embargos', 'edcl', 'ed') ? 'acordao_embargos' : 'acordao';
  if (tem('embargos', 'edcl')) return 'acordao_embargos';
  if (tem('extraordinario', 're')) return 'recurso_extraordinario';
  if (tem('especial', 'resp')) return 'recurso_especial';
  return padrao;
}

interface DocumentUploadSectionProps {
  files: UploadedFileItem[];
  onAddFile: (fileItem: UploadedFileItem) => void;
  onRemoveFile: (id: string) => void;
  onUpdateRole: (id: string, role: UploadedFileItem['role']) => void;
  onUpdateFile: (id: string, patch: Partial<UploadedFileItem>) => void;
  notes: string;
  setNotes: (val: string) => void;
  appealType: string;
  setAppealType: (val: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onLoadSample: () => void;
  onError: (msg: string) => void;
  stageMessage: string;
  engineSettings: React.ReactNode;
  prazoForm: React.ReactNode;
  consent: boolean;
  setConsent: (v: boolean) => void;
  canAnalyze: boolean;
  missingReason: string;
  casos: CasoResumo[];
  buscaCasos: string;
  onBuscaCasos: (q: string) => void;
  onOpenCaso: (id: string) => void;
  onDeleteCaso: (c: CasoResumo) => void;
  podeExcluir: (c: CasoResumo) => boolean;
  onClearLocal: () => void;
  onCancel: () => void;
}

const PAPEIS_ACORDAO = [
  { v: 'acordao' as const, r: 'Acórdão' },
  { v: 'acordao_embargos' as const, r: 'Acórdão dos embargos' },
];
const PAPEIS_RECURSO = [
  { v: 'recurso_especial' as const, r: 'Recurso especial' },
  { v: 'recurso_extraordinario' as const, r: 'Recurso extraordinário' },
  { v: 'outro' as const, r: 'Outra peça' },
];

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  files,
  onAddFile,
  onRemoveFile,
  onUpdateRole,
  onUpdateFile,
  notes,
  setNotes,
  appealType,
  setAppealType,
  onAnalyze,
  isAnalyzing,
  onLoadSample,
  onError,
  stageMessage,
  engineSettings,
  prazoForm,
  consent,
  setConsent,
  canAnalyze,
  missingReason,
  casos,
  buscaCasos,
  onBuscaCasos,
  onOpenCaso,
  onDeleteCaso,
  podeExcluir,
  onClearLocal,
  onCancel,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelection = async (fileList: FileList, roleOverride?: UploadedFileItem['role']) => {
    let quantidade = files.length;
    for (const file of Array.from(fileList)) {
      const ehPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!ehPdf) {
        onError(`"${file.name}" não é um PDF e foi ignorado.`);
        continue;
      }
      if (quantidade >= LIMITES.maxArquivos) {
        onError(`Limite de ${LIMITES.maxArquivos} arquivos por análise atingido.`);
        break;
      }
      if (file.size > 60 * 1048576) {
        onError(`"${file.name}" tem mais de 60 MB e não pode ser processado no navegador.`);
        continue;
      }
      quantidade++;
      const id = crypto.randomUUID();
      onAddFile({
        id,
        name: file.name,
        size: file.size,
        role: detectarPapel(file.name, roleOverride || 'recurso_especial'),
        label: file.name.replace(/\.[^/.]+$/, ''),
        arquivo: file,
        modo: 'texto',
        extraindo: true,
      });
      try {
        const r = await extrairPdf(file);
        if (r.escaneado || r.caracteres === 0) {
          onUpdateFile(id, {
            extraindo: false,
            modo: 'pdf',
            paginas: r.paginas,
            avisoExtracao: 'PDF sem camada de texto (escaneado): será enviado como PDF, com mais tokens. Se possível, use uma versão pesquisável.',
          });
        } else {
          onUpdateFile(id, {
            extraindo: false,
            modo: 'texto',
            paginas: r.paginas,
            textPreview: r.texto,
            caracteres: r.caracteres,
            linhasRemovidas: r.linhasRemovidas,
            protocolo: r.protocolo ?? undefined,
          });
        }
      } catch {
        onUpdateFile(id, {
          extraindo: false,
          modo: 'pdf',
          avisoExtracao: 'Não foi possível ler o texto deste PDF: será enviado o arquivo original.',
        });
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelection(e.dataTransfer.files);
    }
  };

  const acordaoFiles = files.filter((f) => f.role === 'acordao' || f.role === 'acordao_embargos');
  const recursoFiles = files.filter((f) => f.role === 'recurso_especial' || f.role === 'recurso_extraordinario' || f.role === 'outro');

  const seletor = (rotulo: string, papel: UploadedFileItem['role'], multiplo = false) => (
    <label className={`${'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-linha-forte bg-folha px-2.5 text-[13px] font-medium text-tinta transition-colors hover:border-tinta-3'} focus-within:ring-2 focus-within:ring-toga/30`}>
      <Plus className="size-3.5 text-tinta-3" />
      {rotulo}
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiplo}
        className="sr-only"
        onChange={async (e) => {
          if (e.target.files) await handleFileSelection(e.target.files, papel);
          e.target.value = '';
        }}
      />
    </label>
  );

  const grupo = (titulo: string, lista: UploadedFileItem[], vazio: string, papeis: typeof PAPEIS_ACORDAO | typeof PAPEIS_RECURSO) => (
    <div>
      <div className="flex items-baseline justify-between border-b border-linha pb-2">
        <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
        <span className="num text-[13px] text-tinta-3">{lista.length}</span>
      </div>
      {lista.length === 0 ? (
        <p className="py-3.5 text-sm text-tinta-3">{vazio}</p>
      ) : (
        <ul className="divide-y divide-linha">
          {lista.map((file) => (
            <ArquivoCard key={file.id} file={file} papeis={papeis} onUpdateRole={onUpdateRole} onRemove={onRemoveFile} onUpdate={onUpdateFile} />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <h1 className="font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-tinta">Novo exame</h1>
          <p className="mt-2 max-w-xl text-[15px] text-tinta-2">Anexe o acórdão recorrido e os recursos. O texto dos PDFs é lido aqui no navegador antes de qualquer envio.</p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`mt-8 rounded-lg border border-dashed px-6 py-8 transition-colors ${dragActive ? 'border-toga bg-toga-claro' : 'border-linha-forte bg-folha'}`}
          >
            <div className="flex flex-col items-center text-center">
              <Upload className="size-5 text-tinta-3" />
              <p className="mt-2.5 text-sm text-tinta">Arraste os PDFs para cá</p>
              <p className="mt-0.5 text-[13px] text-tinta-3">O tipo de cada peça é reconhecido pelo nome do arquivo. Ou escolha:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {seletor('Acórdão', 'acordao')}
                {seletor('Recurso', 'recurso_especial', true)}
                {seletor('Embargos de declaração', 'acordao_embargos')}
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-8">
            {grupo('Acórdão recorrido', acordaoFiles, 'Nenhum acórdão anexado.', PAPEIS_ACORDAO)}
            {grupo('Recursos', recursoFiles, 'Nenhum recurso anexado. É possível anexar o especial e o extraordinário juntos.', PAPEIS_RECURSO)}

            <div>
              <Rotulo htmlFor="notas" dica="opcional">
                Observações para a análise
              </Rotulo>
              <textarea
                id="notas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: gratuidade deferida em 1º grau; feriado municipal comprovado no mov. 15.2"
                rows={3}
                className={`${campoArea} resize-y`}
              />
            </div>
          </div>
        </div>

        <aside className="lg:pt-[5.5rem]">
          <Folha as="div" className="space-y-5 p-5 lg:sticky lg:top-6">
            {prazoForm}

            <div className="border-t border-linha pt-5">
              <Rotulo htmlFor="foco">Recursos a examinar</Rotulo>
              <select id="foco" value={appealType} onChange={(e) => setAppealType(e.target.value)} className={campoSelect}>
                <option value="auto">Identificar automaticamente</option>
                <option value="resp">Recurso especial (STJ)</option>
                <option value="re">Recurso extraordinário (STF)</option>
                <option value="ambos">Ambos, em conjunto</option>
              </select>
            </div>

            <div className="border-t border-linha pt-4">{engineSettings}</div>

            <div className="space-y-3 border-t border-linha pt-5">
              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-tinta-2">
                <input type="checkbox" className="mt-0.5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Estou autorizado a enviar estes autos a um provedor externo de IA; não tramitam em segredo de justiça nem contêm dados vedados pela política do órgão (LGPD, Res. CNJ 615/2025).
                </span>
              </label>

              {isAnalyzing ? (
                <div role="status" aria-live="polite" className="space-y-2.5">
                  <Botao variante="primario" disabled className="w-full !opacity-100">
                    <Loader2 className="size-4 animate-spin" />
                    Analisando
                  </Botao>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-tinta-3">{stageMessage || 'Iniciando…'}</span>
                    <button type="button" onClick={onCancel} className="text-tinta-2 underline underline-offset-2 hover:text-tinta">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Botao variante="primario" disabled={!canAnalyze} onClick={onAnalyze} className="w-full">
                    Analisar admissibilidade
                  </Botao>
                  {!canAnalyze && missingReason && <Ajuda className="mt-0">{missingReason}</Ajuda>}
                </>
              )}
            </div>

            <button type="button" disabled={isAnalyzing} onClick={onLoadSample} className="text-[13px] text-tinta-3 underline-offset-2 hover:text-tinta hover:underline disabled:opacity-50">
              Abrir um caso de exemplo
            </button>
          </Folha>
        </aside>
      </div>

      <section aria-labelledby="registros-titulo">
        <div className="flex flex-col gap-3 border-b border-linha pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <TituloSecao id="registros-titulo">Registros da equipe</TituloSecao>
            <p className="mt-1 text-[13px] text-tinta-3">Guardam apenas os dados extraídos e as revisões; os PDFs nunca são gravados.</p>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
            <input
              type="search"
              aria-label="Buscar registros por número, matéria ou autor"
              value={buscaCasos}
              onChange={(e) => onBuscaCasos(e.target.value)}
              placeholder="Número, matéria ou autor"
              className={`${campo} pl-8`}
            />
          </div>
        </div>

        {casos.length === 0 ? (
          <p className="py-6 text-sm text-tinta-3">{buscaCasos ? 'Nenhum registro corresponde à busca.' : 'Nenhum registro ainda. As análises feitas aparecem aqui.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="text-left text-[13px] text-tinta-3">
                <th className="py-2.5 pr-4 font-normal">Processo</th>
                <th className="hidden py-2.5 pr-4 font-normal md:table-cell">Situação</th>
                <th className="hidden py-2.5 pr-4 font-normal sm:table-cell">Última alteração</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linha border-t border-linha sm:border-t-0">
              {casos.map((c) => (
                <tr key={c.id} className="group">
                  <td className="py-3 pr-4 align-top">
                    <button type="button" onClick={() => onOpenCaso(c.id)} className="num text-left font-medium text-toga hover:underline underline-offset-2">
                      {c.numeroProcesso}
                    </button>
                    <span className="mt-0.5 block text-[13px] text-tinta-3 sm:hidden">
                      {ROTULO_STATUS[c.status]}, {c.atualizadoPor.nome}, {dataHora(c.atualizadoEm)}
                    </span>
                  </td>
                  <td className="hidden py-3 pr-4 align-top text-tinta-2 md:table-cell">{ROTULO_STATUS[c.status]}</td>
                  <td className="hidden py-3 pr-4 align-top text-tinta-2 sm:table-cell">
                    {c.atualizadoPor.nome} <span className="num text-tinta-3">em {dataHora(c.atualizadoEm)}, versão {c.versao}</span>
                  </td>
                  <td className="py-2 text-right align-top">
                    {podeExcluir(c) && (
                      <button
                        type="button"
                        onClick={() => onDeleteCaso(c)}
                        aria-label={`Excluir registro ${c.numeroProcesso}`}
                        className="rounded-md p-1.5 text-tinta-3 opacity-60 transition hover:bg-obice-fundo hover:text-obice group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button type="button" onClick={onClearLocal} className="mt-6 text-[13px] text-tinta-3 underline-offset-2 hover:text-tinta hover:underline">
          Esquecer as chaves de API salvas neste navegador
        </button>
      </section>
    </div>
  );
};
