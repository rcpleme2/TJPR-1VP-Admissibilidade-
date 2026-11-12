import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { DashboardOverview } from './components/DashboardOverview';
import { ChecklistView } from './components/ChecklistView';
import { DecisionDraftView } from './components/DecisionDraftView';
import { PrecedentsView } from './components/PrecedentsView';
import { ConsultaPrecedentes } from './components/ConsultaPrecedentes';
import { EngineSettings } from './components/EngineSettings';
import { ENTRADAS_VAZIAS, PrazoForm } from './components/PrazoForm';
import { TechnicalGuideModal } from './components/TechnicalGuideModal';
import { PDFExportModal } from './components/PDFExportModal';
import {
  AdmissibilityAnalysisResult,
  ChecklistStatus,
  CitacaoPrecedente,
  EntradasPrazo,
  MinutaDecisao1VP,
  Provedor,
  UploadedFileItem,
} from './types/admissibility';
import { verificarResultado } from '../shared/precedentes';
import { verificarPrazos } from '../shared/prazos';
import { LIMITES } from '../shared/schema';
import type { EntradaBase } from '../shared/precedentesBase';
import { analisar, buscarConfig, carregarExemplo, type ConfigServidor } from './lib/api';
import { baixarMinutaWord } from './lib/exportWord';
import {
  apagarDadosLocais,
  definirSalvarLocal,
  lerBaseCustom,
  lerChaves,
  lerConfig,
  lerHistorico,
  lerToken,
  removerDoHistorico,
  salvarBaseCustom,
  salvarChaves,
  salvarConfig,
  salvarLocalAtivo,
  salvarNoHistorico,
  salvarToken,
  type ConfigMotor,
  type RegistroHistorico,
} from './lib/storage';
import { LayoutDashboard, CheckSquare, FileText, AlertCircle, ArrowLeft, Download, ShieldAlert, BookMarked } from 'lucide-react';

type Aba = 'dashboard' | 'checklist' | 'minuta' | 'precedentes';
const TIMEOUT_CLIENTE_MS = 6 * 60_000;

export default function App() {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [notes, setNotes] = useState('');
  const [appealType, setAppealType] = useState('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stage, setStage] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AdmissibilityAnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string>(() => crypto.randomUUID());
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Aba>('dashboard');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [servidor, setServidor] = useState<ConfigServidor | null>(null);
  const [config, setConfig] = useState<ConfigMotor>(lerConfig);
  const [chaves, setChaves] = useState<Partial<Record<Provedor, string>>>(lerChaves);
  const [token, setToken] = useState(lerToken);
  const [consent, setConsent] = useState(false);
  const [prazo, setPrazo] = useState<EntradasPrazo>(ENTRADAS_VAZIAS);
  const [baseCustom, setBaseCustom] = useState<EntradaBase[]>(lerBaseCustom);
  const [historico, setHistorico] = useState<RegistroHistorico[]>(lerHistorico);
  const [saveLocal, setSaveLocalState] = useState(salvarLocalAtivo);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    buscarConfig().then(setServidor);
  }, []);
  useEffect(() => salvarConfig(config), [config]);
  useEffect(() => salvarChaves(chaves, config.lembrarChaves), [chaves, config.lembrarChaves]);
  useEffect(() => salvarToken(token), [token]);
  useEffect(() => salvarBaseCustom(baseCustom), [baseCustom]);

  // Autosave da análise (com edições do assessor) no histórico local.
  useEffect(() => {
    if (!analysisResult) return;
    const t = setTimeout(() => {
      salvarNoHistorico(analysisId, analysisResult);
      setHistorico(lerHistorico());
    }, 600);
    return () => clearTimeout(t);
  }, [analysisResult, analysisId]);

  // Reverificação automática dos precedentes quando a minuta/checklist/base mudam.
  const texto = analysisResult
    ? JSON.stringify([analysisResult.minutaDecisao1VP, analysisResult.checklistSecoes.map((s) => s.itens.map((i) => [i.analiseTecnica, i.fundamentoLegal]))])
    : '';
  const precedentesRef = useRef<CitacaoPrecedente[] | undefined>(undefined);
  precedentesRef.current = analysisResult?.precedentes;
  const reverificar = useCallback(() => {
    setAnalysisResult((prev) =>
      prev ? { ...prev, precedentes: verificarResultado(prev, { baseCustom, anteriores: precedentesRef.current }) } : prev,
    );
  }, [baseCustom]);
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(reverificar, 900);
    return () => clearTimeout(t);
  }, [texto, reverificar]);

  const provider = config.provider;
  const usaChaveServidor = Boolean(servidor?.serverKeys.includes(provider) && config.usarChaveDoServidor);
  const temChave = usaChaveServidor || Boolean(chaves[provider]);
  const protocolosDetectados = files
    .filter((f) => (f.role === 'recurso_especial' || f.role === 'recurso_extraordinario') && f.protocolo)
    .map((f) => ({ arquivo: f.name, papel: f.role as 'recurso_especial' | 'recurso_extraordinario', ...f.protocolo! }));
  const bytesPdf = files.filter((f) => f.modo === 'pdf').reduce((t, f) => t + f.size, 0);
  const extraindo = files.some((f) => f.extraindo);
  const temAcordao = files.some((f) => f.role === 'acordao' || f.role === 'acordao_embargos');
  const temRecurso = files.some((f) => f.role === 'recurso_especial' || f.role === 'recurso_extraordinario');
  const faltando = !temAcordao
    ? 'Anexe o acórdão recorrido.'
    : !temRecurso
      ? 'Anexe ao menos um recurso (REsp ou RE).'
      : !temChave
        ? `Informe a chave de API do motor ${provider.toUpperCase()}.`
        : extraindo
          ? 'Aguarde a extração do texto dos PDFs.'
          : bytesPdf > LIMITES.maxBytesTotal
            ? `Os PDFs enviados como arquivo somam ${(bytesPdf / 1048576).toFixed(0)} MB (limite ${(LIMITES.maxBytesTotal / 1048576).toFixed(0)} MB). Desmarque "Enviar o PDF original" nos que têm texto.`
            : !prazo.dataIntimacaoAcordao
              ? 'Informe a data da intimação do acórdão.'
              : !prazo.feriadosRespondido
                ? 'Responda se há feriado ou suspensão de expediente no período.'
                : servidor?.authRequired && !token
          ? 'Informe o token de acesso da instalação.'
          : !consent
            ? 'Confirme a declaração de uso autorizado.'
            : '';

  const handleAddFile = (fileItem: UploadedFileItem) => {
    setFiles((prev) => [...prev, fileItem]);
    setErrorMessage(null);
  };
  const handleRemoveFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const handleUpdateFile = (id: string, patch: Partial<UploadedFileItem>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const handleUpdateRole = (id: string, role: UploadedFileItem['role']) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, role } : f)));

  const abrirResultado = (data: AdmissibilityAnalysisResult, id: string = crypto.randomUUID()) => {
    setConsultaAberta(false);
    setAnalysisId(id);
    setAnalysisResult(data);
    setActiveTab('dashboard');
  };

  const handleLoadSample = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSecurityWarnings([]);
      abrirResultado(await carregarExemplo(token));
    } catch (err) {
      setErrorMessage('Erro ao carregar exemplo de teste: ' + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (faltando) return setErrorMessage(faltando);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_CLIENTE_MS);
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSecurityWarnings([]);
      setStage('Enviando documentos…');
      const r = await analisar({
        provider,
        model: config.model[provider] || undefined,
        apiKey: usaChaveServidor ? undefined : chaves[provider],
        token,
        files,
        appealType,
        notes,
        prazo: { ...prazo, protocolos: protocolosDetectados },
        signal: controller.signal,
        onStage: setStage,
      });
      setSecurityWarnings(r.securityWarnings);
      abrirResultado(r.data);
    } catch (err) {
      const e = err as Error;
      if (e.name === 'AbortError' && !controller.signal.reason) setErrorMessage('Análise cancelada.');
      else if (e.name === 'TimeoutError' || controller.signal.reason?.name === 'TimeoutError')
        setErrorMessage('A análise excedeu o tempo limite. Envie menos peças ou arquivos menores.');
      else setErrorMessage('Falha no processamento: ' + e.message);
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setIsAnalyzing(false);
      setStage('');
    }
  };

  const updateResult = (fn: (r: AdmissibilityAnalysisResult) => AdmissibilityAnalysisResult) =>
    setAnalysisResult((prev) => (prev ? fn(prev) : prev));

  const atualizarPrazo = (e: EntradasPrazo) =>
    updateResult((r) => ({ ...r, entradasPrazo: e, verificacoes: verificarPrazos(r, e) }));

  const mapItem = (sectionCode: string, itemId: string, patch: Partial<{ status: ChecklistStatus; observacaoAssessor: string }>) =>
    updateResult((r) => ({
      ...r,
      checklistSecoes: r.checklistSecoes.map((sec) =>
        sec.secaoCodigo !== sectionCode ? sec : { ...sec, itens: sec.itens.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) },
      ),
    }));

  const handleReset = () => {
    setAnalysisResult(null);
    setFiles([]);
    setNotes('');
    setErrorMessage(null);
    setSecurityWarnings([]);
    setConsent(false);
    setPrazo(ENTRADAS_VAZIAS);
    setAnalysisId(crypto.randomUUID());
  };

  const alertasPrecedentes = useMemo(
    () =>
      (analysisResult?.precedentes ?? []).filter(
        (c) => ['inexistente', 'cancelada_ou_superada'].includes(c.verificacao.status) && c.conferencia.situacao === 'pendente',
      ).length,
    [analysisResult?.precedentes],
  );

  const abas: Array<{ id: Aba; rotulo: string; Icon: typeof FileText; badge?: number }> = [
    { id: 'dashboard', rotulo: 'Painel Geral & Diagnóstico', Icon: LayoutDashboard },
    { id: 'checklist', rotulo: 'Checklist Técnico (A a J)', Icon: CheckSquare },
    { id: 'minuta', rotulo: 'Minuta da Decisão (1VP)', Icon: FileText },
    { id: 'precedentes', rotulo: 'Precedentes', Icon: BookMarked, badge: alertasPrecedentes },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-200">
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenConsulta={() => setConsultaAberta(true)}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        hasResult={Boolean(analysisResult)}
        onDownloadPDF={() => setIsPdfModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        {errorMessage && (
          <div role="alert" className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 text-xs font-semibold underline shrink-0">
              Fechar
            </button>
          </div>
        )}

        {securityWarnings.length > 0 && (
          <div role="alert" className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Atenção: padrões suspeitos de manipulação foram sinalizados nas notas/peças</span>
            </div>
            <ul className="list-disc pl-10 text-[11px] text-amber-800">
              {securityWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-800 pl-6">O sistema trata o conteúdo dos autos como dado, mas isso não é garantia: revise a análise com atenção redobrada.</p>
          </div>
        )}

        {consultaAberta ? (
          <ConsultaPrecedentes baseCustom={baseCustom} onBaseChange={setBaseCustom} onClose={() => setConsultaAberta(false)} />
        ) : !analysisResult ? (
          <DocumentUploadSection
            files={files}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
            onUpdateRole={handleUpdateRole}
            onUpdateFile={handleUpdateFile}
            notes={notes}
            setNotes={setNotes}
            appealType={appealType}
            setAppealType={setAppealType}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            onLoadSample={handleLoadSample}
            onError={setErrorMessage}
            stageMessage={stage}
            onCancel={() => abortRef.current?.abort()}
            consent={consent}
            setConsent={setConsent}
            canAnalyze={!faltando}
            missingReason={faltando}
            historico={historico}
            onOpenHistorico={(id) => {
              const h = historico.find((x) => x.id === id);
              if (h) abrirResultado(h.resultado, h.id);
            }}
            onDeleteHistorico={(id) => {
              removerDoHistorico(id);
              setHistorico(lerHistorico());
            }}
            saveLocal={saveLocal}
            setSaveLocal={(v) => {
              setSaveLocalState(v);
              definirSalvarLocal(v);
            }}
            onClearLocal={() => {
              apagarDadosLocais();
              setHistorico([]);
              setChaves({});
              setBaseCustom([]);
              setConfig(lerConfig());
            }}
            prazoForm={<PrazoForm value={prazo} onChange={setPrazo} idPrefix="pre" />}
            engineSettings={
              <EngineSettings
                config={config}
                onConfig={setConfig}
                chaves={chaves}
                onChaves={setChaves}
                token={token}
                onToken={setToken}
                servidor={servidor}
              />
            }
          />
        ) : (
          <div className="space-y-6">
            <div role="note" className="text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
              <strong>Rascunho de apoio, não é decisão.</strong>{' '}
              {analysisResult.meta && analysisResult.meta.provedor !== 'exemplo'
                ? `Gerado por ${analysisResult.meta.provedor.toUpperCase()} (${analysisResult.meta.modelo}) em ${new Date(analysisResult.meta.geradoEm).toLocaleString('pt-BR')}. `
                : analysisResult.meta?.provedor === 'exemplo'
                  ? 'Caso simulado para demonstração. '
                  : ''}
              A IA pode errar fatos, datas e citações: confira os autos, os prazos calculados e os precedentes antes de qualquer uso.
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs">
              <div role="tablist" className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                {abas.map(({ id, rotulo, Icon, badge }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={activeTab === id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      activeTab === id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{rotulo}</span>
                    {badge ? <span className="ml-0.5 bg-rose-600 text-white rounded-full px-1.5 text-[11px]">{badge}</span> : null}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
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
                  title="Voltar ao início (a análise fica salva neste navegador)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <DashboardOverview
                data={analysisResult}
                onChangePrazo={atualizarPrazo}
                onNavigateToChecklist={() => setActiveTab('checklist')}
                onNavigateToMinuta={() => setActiveTab('minuta')}
                onDownloadPDF={() => setIsPdfModalOpen(true)}
              />
            )}

            {activeTab === 'checklist' && (
              <ChecklistView
                sections={analysisResult.checklistSecoes}
                onUpdateItemStatus={(sec, id, status) => mapItem(sec, id, { status })}
                onUpdateItemNote={(sec, id, note) => mapItem(sec, id, { observacaoAssessor: note })}
              />
            )}

            {activeTab === 'minuta' && (
              <DecisionDraftView
                minuta={analysisResult.minutaDecisao1VP}
                isMista={analysisResult.diagnosticoGeral.isDecisaoMista}
                onChange={(m: MinutaDecisao1VP) => updateResult((r) => ({ ...r, minutaDecisao1VP: m }))}
                onDownloadPDF={() => setIsPdfModalOpen(true)}
                onDownloadWord={() => baixarMinutaWord(analysisResult.minutaDecisao1VP, analysisResult.processo.numero)}
              />
            )}

            {activeTab === 'precedentes' && (
              <PrecedentsView
                citacoes={analysisResult.precedentes ?? []}
                baseCustom={baseCustom}
                onChange={(c) => updateResult((r) => ({ ...r, precedentes: c }))}
                onReverificar={reverificar}
                onBaseChange={setBaseCustom}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <p>Tribunal de Justiça do Estado do Paraná • 1ª Vice-Presidência • Sistema de Admissibilidade Recursal</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Conforme Lei 15.484/2026, Emenda Regimental STJ 55/2026 e Código de Processo Civil (art. 1.030)
        </p>
      </footer>

      <TechnicalGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {analysisResult && <PDFExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} data={analysisResult} />}
    </div>
  );
}
