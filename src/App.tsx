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
import { apagarDadosLocais, lerChaves, lerConfig, salvarChaves, salvarConfig, type ConfigMotor } from './lib/storage';
import { ErroApi, nuvem, type UsuarioNuvem } from './lib/nuvem';
import type { Caso, CasoResumo, StatusCaso } from '../shared/registro';
import { LoginView } from './components/LoginView';
import { SaveBar, type EstadoSalvamento } from './components/SaveBar';
import { HistoricoModal } from './components/HistoricoModal';
import { ContaModal } from './components/ContaModal';
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
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Aba>('dashboard');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [servidor, setServidor] = useState<ConfigServidor | null>(null);
  const [config, setConfig] = useState<ConfigMotor>(lerConfig);
  const [chaves, setChaves] = useState<Partial<Record<Provedor, string>>>(lerChaves);
  const [consent, setConsent] = useState(false);
  const [prazo, setPrazo] = useState<EntradasPrazo>(ENTRADAS_VAZIAS);
  const [baseCustom, setBaseCustom] = useState<EntradaBase[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // --- sessão e registros na nuvem ---------------------------------------------------------------
  const [usuario, setUsuario] = useState<UsuarioNuvem | null>(null);
  const [autenticando, setAutenticando] = useState(true);
  const [contaAberta, setContaAberta] = useState(false);
  const [histAberto, setHistAberto] = useState(false);
  const [casos, setCasos] = useState<CasoResumo[]>([]);
  const [buscaCasos, setBuscaCasos] = useState('');
  const [registro, setRegistro] = useState<{ id: string; versao: number; status: StatusCaso; atualizadoPor: string; atualizadoEm: string } | null>(null);
  const [salvamento, setSalvamento] = useState<{ estado: EstadoSalvamento; mensagem?: string; conflito?: { versao: number; por: string; em: string } }>({ estado: 'novo' });
  const baselineRef = useRef('');
  const statusGravadoRef = useRef<StatusCaso>('em_analise');
  const salvandoRef = useRef(false);
  const pendenteRef = useRef(false);
  const resultRef = useRef<AdmissibilityAnalysisResult | null>(null);
  const registroRef = useRef(registro);
  const salvamentoRef = useRef(salvamento);
  resultRef.current = analysisResult;
  registroRef.current = registro;
  salvamentoRef.current = salvamento;

  useEffect(() => {
    buscarConfig().then(setServidor);
  }, []);
  useEffect(() => salvarConfig(config), [config]);
  useEffect(() => salvarChaves(chaves, config.lembrarChaves), [chaves, config.lembrarChaves]);

  useEffect(() => {
    nuvem
      .me()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setAutenticando(false));
  }, []);

  const sessaoExpirada = (e: unknown) => {
    if (e instanceof ErroApi && e.status === 401) setUsuario(null);
  };

  const atualizarLista = useCallback(
    (busca = buscaCasos) =>
      nuvem.casos
        .listar(busca)
        .then(setCasos)
        .catch(sessaoExpirada),
    [buscaCasos],
  );
  useEffect(() => {
    if (!usuario) return;
    const t = setTimeout(() => atualizarLista(buscaCasos), 300);
    return () => clearTimeout(t);
  }, [usuario, buscaCasos, atualizarLista]);

  useEffect(() => {
    if (usuario) nuvem.base.listar().then(setBaseCustom).catch(sessaoExpirada);
  }, [usuario]);

  /** Base compartilhada: grava na nuvem só o que foi incluído/alterado (sem apagar o que outros cadastraram). */
  const handleBaseChange = async (nova: EntradaBase[]) => {
    const chave = (e: EntradaBase) => `${e.tipo}|${e.tribunal}|${e.numero}`;
    const forma = (e?: EntradaBase) => (e ? JSON.stringify([e.enunciado, e.situacao, e.palavrasChave]) : '');
    const antigas = new Map(baseCustom.map((e) => [chave(e), e]));
    const mudadas = nova.filter((e) => forma(e) !== forma(antigas.get(chave(e))));
    if (mudadas.length === 0) return;
    try {
      setBaseCustom(await nuvem.base.salvar(mudadas));
    } catch (e) {
      sessaoExpirada(e);
      setErrorMessage('Não foi possível gravar a base de precedentes: ' + (e as Error).message);
    }
  };

  const adotarCaso = (c: Caso, trocarAba = true) => {
    setConsultaAberta(false);
    setAnalysisResult(c.dados);
    baselineRef.current = JSON.stringify(c.dados);
    statusGravadoRef.current = c.status;
    setRegistro({ id: c.id, versao: c.versao, status: c.status, atualizadoPor: c.atualizadoPor.nome, atualizadoEm: c.atualizadoEm });
    setSalvamento({ estado: 'salvo' });
    if (trocarAba) setActiveTab('dashboard');
  };

  const tratarErroGravacao = (e: unknown) => {
    sessaoExpirada(e);
    if (e instanceof ErroApi) {
      if (e.codigo === 'conflito') {
        const a = e.extra?.atual as CasoResumo;
        return setSalvamento({ estado: 'conflito', conflito: { versao: a.versao, por: a.atualizadoPor.nome, em: a.atualizadoEm } });
      }
      if (e.codigo === 'numero_invalido') return setSalvamento({ estado: 'numero_invalido', mensagem: e.message });
      return setSalvamento({ estado: 'erro', mensagem: e.message });
    }
    setSalvamento({ estado: 'erro', mensagem: 'Sem conexão com o servidor.' });
  };

  /** Atualiza o registro existente (controle de versão otimista). */
  const gravar = async (versaoBase?: number) => {
    const r = registroRef.current;
    const dados = resultRef.current;
    if (!r || !dados) return;
    if (salvandoRef.current) {
      pendenteRef.current = true;
      return;
    }
    salvandoRef.current = true;
    setSalvamento((s) => ({ ...s, estado: 'salvando', conflito: undefined }));
    const enviado = JSON.stringify(dados);
    try {
      const c = await nuvem.casos.atualizar(r.id, versaoBase ?? r.versao, dados, r.status);
      baselineRef.current = enviado;
      statusGravadoRef.current = r.status;
      setRegistro((atual) => (atual ? { ...atual, versao: c.versao, atualizadoPor: c.atualizadoPor.nome, atualizadoEm: c.atualizadoEm } : atual));
      setSalvamento({ estado: 'salvo' });
      atualizarLista();
    } catch (e) {
      tratarErroGravacao(e);
    } finally {
      salvandoRef.current = false;
      if (pendenteRef.current) {
        pendenteRef.current = false;
        gravar();
      }
    }
  };

  /** Cria o registro a partir de uma análise nova: só os dados extraídos/calculados, nunca os arquivos. */
  const criarRegistro = async (dados: AdmissibilityAnalysisResult) => {
    setSalvamento({ estado: 'salvando' });
    try {
      adotarCaso(await nuvem.casos.criar(dados), false);
      atualizarLista();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'numero_duplicado') {
        const ex = e.extra?.existente as CasoResumo;
        const substituir = window.confirm(
          `Já existe um registro deste processo (v${ex.versao}, alterado por ${ex.atualizadoPor.nome} em ${new Date(ex.atualizadoEm).toLocaleString('pt-BR')}).\n\nOK = substituir os dados pela nova análise (a versão anterior fica no histórico).\nCancelar = abrir o registro existente.`,
        );
        try {
          adotarCaso(substituir ? await nuvem.casos.atualizar(ex.id, ex.versao, dados) : await nuvem.casos.obter(ex.id), false);
          atualizarLista();
        } catch (e2) {
          tratarErroGravacao(e2);
        }
        return;
      }
      setRegistro(null);
      tratarErroGravacao(e);
    }
  };

  // Autosave: grava as edições do assessor (com pequena espera) quando há mudança em relação ao último gravado.
  useEffect(() => {
    if (!analysisResult || !registro || analysisResult.meta?.provedor === 'exemplo') return;
    if (salvamentoRef.current.estado === 'conflito') return;
    if (JSON.stringify(analysisResult) === baselineRef.current && registro.status === statusGravadoRef.current) return;
    const t = setTimeout(() => gravar(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult, registro?.status]);

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

  const abrirResultado = (data: AdmissibilityAnalysisResult) => {
    setConsultaAberta(false);
    setAnalysisResult(data);
    setRegistro(null);
    setSalvamento({ estado: data.meta?.provedor === 'exemplo' ? 'exemplo' : 'novo' });
    setActiveTab('dashboard');
  };

  const handleLoadSample = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setSecurityWarnings([]);
      abrirResultado(await carregarExemplo());
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
        files,
        appealType,
        notes,
        prazo: { ...prazo, protocolos: protocolosDetectados },
        signal: controller.signal,
        onStage: setStage,
      });
      setSecurityWarnings(r.securityWarnings);
      abrirResultado(r.data);
      criarRegistro(r.data);
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
    setRegistro(null);
    setSalvamento({ estado: 'novo' });
    baselineRef.current = '';
    atualizarLista();
  };

  const alterarNumero = (n: string) => {
    if (!analysisResult) return;
    const novo = { ...analysisResult, processo: { ...analysisResult.processo, numero: n } };
    setAnalysisResult(novo);
    if (!registro && novo.meta?.provedor !== 'exemplo') criarRegistro(novo);
  };

  const carregarDaNuvem = async () => {
    if (!registro) return;
    try {
      adotarCaso(await nuvem.casos.obter(registro.id), false);
    } catch (e) {
      tratarErroGravacao(e);
    }
  };

  const restaurarVersao = async (v: number) => {
    if (!registro) return;
    try {
      const dados = await nuvem.casos.versao(registro.id, v);
      setAnalysisResult(dados); // vira edição local; o autosave grava como nova versão
      setHistAberto(false);
    } catch (e) {
      tratarErroGravacao(e);
    }
  };

  const abrirCasoDaLista = async (id: string) => {
    try {
      adotarCaso(await nuvem.casos.obter(id));
    } catch (e) {
      sessaoExpirada(e);
      setErrorMessage('Não foi possível abrir o registro: ' + (e as Error).message);
    }
  };

  const excluirCaso = async (c: CasoResumo) => {
    if (!window.confirm(`Excluir definitivamente o registro ${c.numeroProcesso}, com todo o histórico?`)) return;
    try {
      await nuvem.casos.excluir(c.id);
      if (registro?.id === c.id) handleReset();
      atualizarLista();
    } catch (e) {
      sessaoExpirada(e);
      setErrorMessage('Não foi possível excluir: ' + (e as Error).message);
    }
  };

  const sair = async () => {
    await nuvem.logout().catch(() => {});
    if (!config.lembrarChaves) setChaves({});
    handleReset();
    setUsuario(null);
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

  if (autenticando) return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  if (!usuario) return <LoginView onLogin={setUsuario} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-200">
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenConsulta={() => setConsultaAberta(true)}
        onLoadSample={handleLoadSample}
        onReset={handleReset}
        hasResult={Boolean(analysisResult)}
        onDownloadPDF={() => setIsPdfModalOpen(true)}
        usuarioNome={usuario?.nome}
        onConta={() => setContaAberta(true)}
        onLogout={sair}
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
          <ConsultaPrecedentes baseCustom={baseCustom} onBaseChange={handleBaseChange} onClose={() => setConsultaAberta(false)} />
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
            casos={casos}
            buscaCasos={buscaCasos}
            onBuscaCasos={setBuscaCasos}
            onOpenCaso={abrirCasoDaLista}
            onDeleteCaso={excluirCaso}
            podeExcluir={(c) => usuario?.papel === 'admin' || c.criadoPor.id === usuario?.id}
            onClearLocal={() => {
              apagarDadosLocais();
              setChaves({});
              setConfig(lerConfig());
            }}
            prazoForm={<PrazoForm value={prazo} onChange={setPrazo} idPrefix="pre" />}
            engineSettings={
              <EngineSettings
                config={config}
                onConfig={setConfig}
                chaves={chaves}
                onChaves={setChaves}
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

            <SaveBar
              estado={analysisResult.meta?.provedor === 'exemplo' ? 'exemplo' : salvamento.estado}
              numero={analysisResult.processo.numero}
              onNumero={alterarNumero}
              versao={registro?.versao}
              atualizadoPor={registro?.atualizadoPor}
              atualizadoEm={registro?.atualizadoEm}
              status={registro?.status ?? 'em_analise'}
              onStatus={(st) => setRegistro((r) => (r ? { ...r, status: st } : r))}
              mensagem={salvamento.mensagem}
              onRetry={() => gravar()}
              onHistorico={() => setHistAberto(true)}
              conflito={salvamento.conflito}
              onCarregarNuvem={carregarDaNuvem}
              onSobrescrever={() => gravar(salvamento.conflito?.versao)}
            />

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
                onBaseChange={handleBaseChange}
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

      {contaAberta && <ContaModal usuario={usuario} onClose={() => setContaAberta(false)} />}
      {histAberto && registro && <HistoricoModal casoId={registro.id} versaoAtual={registro.versao} onClose={() => setHistAberto(false)} onRestaurar={restaurarVersao} />}

      <TechnicalGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {analysisResult && <PDFExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} data={analysisResult} />}
    </div>
  );
}
