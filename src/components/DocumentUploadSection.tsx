import React, { useState } from 'react';
import {
  Upload,
  FileCheck,
  FileText,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  FileWarning,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { UploadedFileItem } from '../types/admissibility';
import { LIMITES } from '../../shared/schema';
import type { RegistroHistorico } from '../lib/storage';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';

/** Papel do arquivo a partir de palavras inteiras do nome (evita falsos positivos como "resposta" → REsp). */
export function detectarPapel(nome: string, padrao: UploadedFileItem['role']): UploadedFileItem['role'] {
  const tokens = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const tem = (...ps: string[]) => ps.some((p) => tokens.includes(p));
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
  consent: boolean;
  setConsent: (v: boolean) => void;
  canAnalyze: boolean;
  missingReason: string;
  historico: RegistroHistorico[];
  onOpenHistorico: (id: string) => void;
  onDeleteHistorico: (id: string) => void;
  saveLocal: boolean;
  setSaveLocal: (v: boolean) => void;
  onClearLocal: () => void;
  onCancel: () => void;
}

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  files,
  onAddFile,
  onRemoveFile,
  onUpdateRole,
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
  consent,
  setConsent,
  canAnalyze,
  missingReason,
  historico,
  onOpenHistorico,
  onDeleteHistorico,
  saveLocal,
  setSaveLocal,
  onClearLocal,
  onCancel,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UploadedFileItem['role']>('recurso_especial');

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelection = async (fileList: FileList, roleOverride?: UploadedFileItem['role']) => {
    let acumulado = files.reduce((t, f) => t + f.size, 0);
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
      if (acumulado + file.size > LIMITES.maxBytesTotal) {
        onError(
          `"${file.name}" excede o limite total de ${(LIMITES.maxBytesTotal / 1048576).toFixed(0)} MB por análise. Envie somente as peças necessárias (acórdão e recursos).`,
        );
        continue;
      }
      const role = detectarPapel(file.name, roleOverride || selectedRole);
      try {
        const base64 = await fileToBase64(file);
        acumulado += file.size;
        quantidade++;
        onAddFile({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          role,
          label: file.name.replace(/\.[^/.]+$/, ''),
          dataBase64: base64,
        });
      } catch {
        onError(`Não foi possível ler "${file.name}".`);
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
  const recursoFiles = files.filter(
    (f) => f.role === 'recurso_especial' || f.role === 'recurso_extraordinario' || f.role === 'outro'
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Sober Informative Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5 shrink-0">
              <AlertCircle className="w-4 h-4 text-slate-700" />
            </div>
            <div className="text-xs">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span>Marco Temporal da Relevância: Lei 15.484/2026 e Emenda Regimental STJ 55/2026</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  Vigência {MARCO_RELEVANCIA_BR}
                </span>
              </h3>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Recursos Especiais interpostos contra acórdãos publicados a partir de <strong>{MARCO_RELEVANCIA_BR}</strong> exigem
                obrigatoriamente tópico específico e fundamentado de <strong>Relevância da Questão Federal</strong> (CPC,
                art. 1.035-A). O sistema verifica a regularidade formal, precedentes qualificados e as saídas do{' '}
                <strong>art. 1.030 do CPC</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium shrink-0 self-start">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rascunho assistido por IA – revisão humana obrigatória</span>
          </div>
        </div>
      </div>

      {/* Main Upload Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & File List */}
        <div className="lg:col-span-8 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-7 text-center transition ${
              dragActive ? 'border-slate-400 bg-slate-100/60' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-2.5">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              Selecione ou arraste os arquivos do processo em PDF
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Inclua o <strong>Acórdão Recorrido</strong> e os <strong>Recursos (REsp e/ou RE)</strong>. É possível
              adicionar mais de uma petição recursal concomitante.
            </p>

            {/* Upload Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs">
                <FileCheck className="w-3.5 h-3.5" />
                <span>+ Acórdão Principal</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      await handleFileSelection(e.target.files, 'acordao');
                    }
                  }}
                />
              </label>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition shadow-xs">
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>+ Recurso (REsp / RE)</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      await handleFileSelection(e.target.files, 'recurso_especial');
                    }
                  }}
                />
              </label>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>+ Embargos de Declaração</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      await handleFileSelection(e.target.files, 'acordao_embargos');
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Files List */}
          <div className="space-y-4">
            {/* Acórdãos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Acórdão Recorrido & Decisões ({acordaoFiles.length})
                </span>
                {acordaoFiles.length === 0 && (
                  <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Obrigatório para aferir data e fundamentos
                  </span>
                )}
              </div>

              {acordaoFiles.length === 0 ? (
                <div className="border border-slate-200 bg-white rounded-xl p-3.5 text-center text-xs text-slate-400">
                  Nenhum acórdão anexado ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {acordaoFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={file.role}
                          onChange={(e) => onUpdateRole(file.id, e.target.value as any)}
                          className="bg-slate-50 text-[11px] text-slate-700 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-500"
                        >
                          <option value="acordao">Acórdão Principal</option>
                          <option value="acordao_embargos">Acórdão Embargos Declaração</option>
                        </select>
                        <button
                          onClick={() => onRemoveFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                          title="Remover arquivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recursos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <FileWarning className="w-3.5 h-3.5 text-slate-500" />
                  Petições Recursais ({recursoFiles.length})
                </span>
                {recursoFiles.length > 1 && (
                  <span className="text-[11px] text-slate-600 font-medium">
                    Múltiplos recursos anexados (análise conjunta)
                  </span>
                )}
              </div>

              {recursoFiles.length === 0 ? (
                <div className="border border-slate-200 bg-white rounded-xl p-3.5 text-center text-xs text-slate-400">
                  Nenhum recurso anexado ainda (REsp e/ou RE).
                </div>
              ) : (
                <div className="space-y-2">
                  {recursoFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition shadow-xs"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={file.role}
                          onChange={(e) => onUpdateRole(file.id, e.target.value as any)}
                          className="bg-slate-50 text-[11px] text-slate-700 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-500"
                        >
                          <option value="recurso_especial">Recurso Especial (STJ)</option>
                          <option value="recurso_extraordinario">Recurso Extraordinário (STF)</option>
                          <option value="outro">Recurso Adesivo / Outro</option>
                        </select>
                        <button
                          onClick={() => onRemoveFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                          title="Remover arquivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Fast Action */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Parâmetros de Análise
            </h4>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Foco do Julgamento
              </label>
              <select
                value={appealType}
                onChange={(e) => setAppealType(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="auto">Detecção Automática (REsp e/ou RE simultâneos)</option>
                <option value="resp">Foco em Recurso Especial (STJ - Lei 15.484/2026)</option>
                <option value="re">Foco em Recurso Extraordinário (STF - Repercussão Geral)</option>
                <option value="ambos">Concomitantes (Análise Completa de Ambos)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                <span>Informações Adicionais (Projudi / Prazos)</span>
                <span className="text-[11px] text-slate-400">Opcional</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Acórdão publicado no DJe em 15/09/2026. Houve comprovação de feriado de padroeiro municipal no mov. 15.2. Gratuidade da justiça deferida em 1º grau..."
                rows={3}
                className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl p-3 outline-none focus:border-slate-500 placeholder:text-slate-400 resize-none"
              ></textarea>
            </div>

            <div className="pt-3 border-t border-slate-100">{engineSettings}</div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <span>
                <strong>Mitigação parcial de prompt injection:</strong> as notas são sanitizadas e os autos são tratados como
                dados não confiáveis; o conteúdo interno dos PDFs não é varrido. Revise sempre o resultado.
              </span>
            </div>

            <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Declaro que estou autorizado a enviar estes autos a um provedor externo de IA e que eles <strong>não estão em
                segredo de justiça</strong> nem contêm dados que a política do órgão proíba (LGPD, Res. CNJ 615/2025).
              </span>
            </label>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                disabled={isAnalyzing || !canAnalyze}
                onClick={onAnalyze}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                  isAnalyzing || !canAnalyze
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando Parecer Técnico...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Processar Admissibilidade</span>
                  </>
                )}
              </button>

              <button
                disabled={isAnalyzing}
                onClick={onLoadSample}
                className="w-full py-2 px-4 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Carregar Exemplo de Teste (1-Clique)</span>
              </button>
            </div>

            {!isAnalyzing && !canAnalyze && missingReason && (
              <p className="text-[11px] text-slate-500">{missingReason}</p>
            )}

            {isAnalyzing && (
              <div role="status" aria-live="polite" className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-800 h-full w-1/3 rounded-full animate-pulse"></div>
                </div>
                <p className="text-[11px] text-slate-600 italic">{stageMessage || 'Iniciando…'}</p>
                <button onClick={onCancel} className="text-[11px] underline text-slate-600 hover:text-slate-900">Cancelar análise</button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2 shadow-xs">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span>Análises salvas neste navegador</span>
              <label className="flex items-center gap-1 text-[11px] font-normal text-slate-600 cursor-pointer">
                <input type="checkbox" checked={saveLocal} onChange={(e) => setSaveLocal(e.target.checked)} /> salvar
              </label>
            </div>
            {historico.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nenhuma análise salva.</p>
            ) : (
              <ul className="space-y-1.5">
                {historico.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <button onClick={() => onOpenHistorico(h.id)} className="text-left min-w-0">
                      <span className="block font-mono text-[11px] text-slate-800 truncate">{h.numero || 'Sem número'}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {new Date(h.atualizadoEm).toLocaleString('pt-BR')} · {h.materia}
                      </span>
                    </button>
                    <button onClick={() => onDeleteHistorico(h.id)} aria-label="Excluir análise salva" className="text-slate-400 hover:text-rose-700 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-400">
              Os dados dos autos ficam só neste navegador.{' '}
              <button onClick={onClearLocal} className="underline hover:text-slate-700">Apagar tudo (inclui chaves)</button>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Etapas da Triagem da 1VP:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>Extração estruturada de partes, órgãos e datas dos autos.</li>
              <li>Aferição do marco de {MARCO_RELEVANCIA_BR} (Lei 15.484/2026).</li>
              <li>Conferência dos 10 blocos de requisitos (A a J).</li>
              <li>Geração da minuta de decisão capitulada sob o CPC art. 1.030.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
