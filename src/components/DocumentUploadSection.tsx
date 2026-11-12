import React, { useState, useEffect } from 'react';
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
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UploadedFileItem['role']>('recurso_especial');
  const [progressStep, setProgressStep] = useState(0);

  // Progressive feedback timer during analysis
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgressStep(0);
      interval = setInterval(() => {
        setProgressStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 3000);
    } else {
      setProgressStep(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const progressSteps = [
    'Sanitizando dados e verificando integridade contra prompt injection...',
    'Auditando datas, publicações e marco temporal da Lei 15.484/2026...',
    'Confrontando teses com Súmulas do STJ/STF e precedentes repetitivos...',
    'Consolidando checklist de A a J e redigindo capítulos da minuta (CPC art. 1.030)...',
  ];

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
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      let role = roleOverride || selectedRole;

      const lower = file.name.toLowerCase();
      if (lower.includes('acordao') || lower.includes('acórdão') || lower.includes('sentenca')) {
        role = lower.includes('embarg') || lower.includes('edcl') ? 'acordao_embargos' : 'acordao';
      } else if (lower.includes('extraordinario') || lower.includes('extraordinário') || lower.includes('re_')) {
        role = 'recurso_extraordinario';
      } else if (lower.includes('especial') || lower.includes('resp')) {
        role = 'recurso_especial';
      }

      const base64 = await fileToBase64(file);

      onAddFile({
        id: 'file_' + Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        role,
        label: file.name.replace(/\.[^/.]+$/, ''),
        dataBase64: base64,
      });
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
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  Vigência 03/09/2026
                </span>
              </h3>
              <p className="text-slate-600 mt-1 leading-relaxed">
                Recursos Especiais interpostos contra acórdãos publicados a partir de <strong>03/09/2026</strong> exigem
                obrigatoriamente tópico específico e fundamentado de <strong>Relevância da Questão Federal</strong> (CPC,
                art. 1.035-A). O sistema verifica a regularidade formal, precedentes qualificados e as saídas do{' '}
                <strong>art. 1.030 do CPC</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium shrink-0 self-start">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Camada Anti-Prompt Injection</span>
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
                          <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
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
                          <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
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
                <span className="text-[10px] text-slate-400">Opcional</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Acórdão publicado no DJe em 15/09/2026. Houve comprovação de feriado de padroeiro municipal no mov. 15.2. Gratuidade da justiça deferida em 1º grau..."
                rows={3}
                className="w-full bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-xl p-3 outline-none focus:border-slate-500 placeholder:text-slate-400 resize-none"
              ></textarea>
            </div>

            {/* Prompt Injection Shield Note */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <span>
                <strong>Blindagem ativa:</strong> As notas e arquivos passam por sanitização prévia contra injeção de
                instruções adversárias.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                disabled={isAnalyzing || files.length === 0}
                onClick={onAnalyze}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                  isAnalyzing || files.length === 0
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

            {/* Step-by-step progress feedback while analyzing */}
            {isAnalyzing && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600 font-medium text-[11px]">
                  <span>Progresso do Checklist:</span>
                  <span>Passo {progressStep + 1} de 4</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-800 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${((progressStep + 1) / 4) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-600 italic">
                  {progressSteps[progressStep]}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Etapas da Triagem da 1VP:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>Extração estruturada de partes, órgãos e datas dos autos.</li>
              <li>Aferição do marco de 03/09/2026 (Lei 15.484/2026).</li>
              <li>Conferência dos 10 blocos de requisitos (A a J).</li>
              <li>Geração da minuta de decisão capitulada sob o CPC art. 1.030.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
