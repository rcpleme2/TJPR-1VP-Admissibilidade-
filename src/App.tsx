import React, { useState } from 'react';
import { Header } from './components/Header';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { DashboardOverview } from './components/DashboardOverview';
import { ChecklistView } from './components/ChecklistView';
import { DecisionDraftView } from './components/DecisionDraftView';
import { TechnicalGuideModal } from './components/TechnicalGuideModal';
import { PDFExportModal } from './components/PDFExportModal';
import {
  AdmissibilityAnalysisResult,
  ChecklistStatus,
  UploadedFileItem,
} from './types/admissibility';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  AlertCircle,
  ArrowLeft,
  Download,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [notes, setNotes] = useState('');
  const [appealType, setAppealType] = useState('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AdmissibilityAnalysisResult | null>(null);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'checklist' | 'minuta'>('dashboard');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddFile = (fileItem: UploadedFileItem) => {
    setFiles((prev) => [...prev, fileItem]);
    setErrorMessage(null);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateRole = (id: string, role: UploadedFileItem['role']) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, role } : f)));
  };

  const handleLoadSample = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSecurityWarnings([]);
      const res = await fetch('/api/sample-case');
      const json = await res.json();
      if (json.success && json.data) {
        setAnalysisResult(json.data);
        setActiveTab('dashboard');
      } else {
        throw new Error('Falha ao carregar caso simulado.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Erro ao carregar exemplo de teste: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setErrorMessage('Por favor, anexe ao menos o acórdão recorrido e uma peça recursal.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSecurityWarnings([]);

      const payload = {
        files: files.map((f) => ({
          name: f.name,
          role: f.role,
          mimeType: f.file?.type || 'application/pdf',
          dataBase64: f.dataBase64 || '',
          textPreview: f.textPreview || '',
        })),
        appealType,
        notes,
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || 'Erro ao processar análise no servidor.');
      }

      if (json.data) {
        setAnalysisResult(json.data);
        if (json.securityWarnings && json.securityWarnings.length > 0) {
          setSecurityWarnings(json.securityWarnings);
        }
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === 'AbortError') {
        setErrorMessage('O processamento excedeu o tempo limite. Tente enviar arquivos menores ou use o botão "Carregar Exemplo".');
      } else {
        setErrorMessage(
          'Falha no processamento: ' +
            (err.message || err) +
            '. Você também pode utilizar o botão "Carregar Exemplo" para simular a análise instantaneamente.'
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateItemStatus = (sectionCode: string, itemId: string, newStatus: ChecklistStatus) => {
    if (!analysisResult) return;
    setAnalysisResult((prev) => {
      if (!prev) return null;
      const updatedSecs = prev.checklistSecoes.map((sec) => {
        if (sec.secaoCodigo !== sectionCode) return sec;
        return {
          ...sec,
          itens: sec.itens.map((it) => (it.id === itemId ? { ...it, status: newStatus } : it)),
        };
      });
      return {
        ...prev,
        checklistSecoes: updatedSecs,
      };
    });
  };

  const handleUpdateItemNote = (sectionCode: string, itemId: string, note: string) => {
    if (!analysisResult) return;
    setAnalysisResult((prev) => {
      if (!prev) return null;
      const updatedSecs = prev.checklistSecoes.map((sec) => {
        if (sec.secaoCodigo !== sectionCode) return sec;
        return {
          ...sec,
          itens: sec.itens.map((it) => (it.id === itemId ? { ...it, observacaoAssessor: note } : it)),
        };
      });
      return {
        ...prev,
        checklistSecoes: updatedSecs,
      };
    });
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setFiles([]);
    setNotes('');
    setErrorMessage(null);
    setSecurityWarnings([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-200">
      {/* Header */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        hasResult={Boolean(analysisResult)}
        onDownloadPDF={() => setIsPdfModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 text-xs font-semibold underline shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Security / Prompt Injection Warning Banner */}
        {securityWarnings.length > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Aviso de Segurança: Padrões de Injeção de Prompt Detectados e Neutralizados</span>
            </div>
            <p className="text-[11px] text-amber-800 pl-6">
              A camada de blindagem detectou comandos atípicos nas peças/notas fornecidas. O modelo processou os autos
              estritamente sob a ótica técnica jurídica, ignorando as tentativas de sobreposição.
            </p>
          </div>
        )}

        {!analysisResult ? (
          /* Step 1: Document Upload & Setup */
          <DocumentUploadSection
            files={files}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
            onUpdateRole={handleUpdateRole}
            notes={notes}
            setNotes={setNotes}
            appealType={appealType}
            setAppealType={setAppealType}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            onLoadSample={handleLoadSample}
          />
        ) : (
          /* Step 2: Analysis Results View with Tabs */
          <div className="space-y-6">
            {/* View Selector Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Painel Geral & Diagnóstico</span>
                </button>

                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'checklist'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Checklist Técnico (A a J)</span>
                </button>

                <button
                  onClick={() => setActiveTab('minuta')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'minuta'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Minuta da Decisão (1VP)</span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsPdfModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                  title="Voltar ao início"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'dashboard' && (
              <DashboardOverview
                data={analysisResult}
                onNavigateToChecklist={() => setActiveTab('checklist')}
                onNavigateToMinuta={() => setActiveTab('minuta')}
                onDownloadPDF={() => setIsPdfModalOpen(true)}
              />
            )}

            {activeTab === 'checklist' && (
              <ChecklistView
                sections={analysisResult.checklistSecoes}
                onUpdateItemStatus={handleUpdateItemStatus}
                onUpdateItemNote={handleUpdateItemNote}
              />
            )}

            {activeTab === 'minuta' && (
              <DecisionDraftView
                minuta={analysisResult.minutaDecisao1VP}
                isMista={analysisResult.diagnosticoGeral.isDecisaoMista}
                onDownloadPDF={() => setIsPdfModalOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <p>
          Tribunal de Justiça do Estado do Paraná • 1ª Vice-Presidência • Sistema de Admissibilidade Recursal
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Conforme Lei 15.484/2026, Emenda Regimental STJ 55/2026 e Código de Processo Civil (art. 1.030)
        </p>
      </footer>

      {/* Modals */}
      <TechnicalGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {analysisResult && (
        <PDFExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          data={analysisResult}
        />
      )}
    </div>
  );
}
