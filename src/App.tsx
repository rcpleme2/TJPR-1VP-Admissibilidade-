import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { DocumentUploadSection } from './components/DocumentUploadSection';
import { DashboardOverview } from './components/DashboardOverview';
import { ChecklistView } from './components/ChecklistView';
import { DecisionDraftView } from './components/DecisionDraftView';
import { PrecedentsView } from './components/PrecedentsView';
import { SobrestamentoView } from './components/SobrestamentoView';
import { avisosSobrestamento, obterSobrestamento } from '../shared/sobrestamento';
import { ConsultaPrecedentes } from './components/ConsultaPrecedentes';
import { EngineSettings, nomeMotor } from './components/EngineSettings';
import { ConfiguracoesModal } from './components/ConfiguracoesModal';
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
import { analisar, buscarConfig, buscarInstrucoesPadrao, carregarExemplo, type ConfigServidor } from './lib/api';
import { baixarMinutaWord } from './lib/exportWord';
import { apagarDadosLocais, lerChaves, lerConfig, lerInstrucoes, salvarChaves, salvarConfig, salvarInstrucoes, type ConfigMotor } from './lib/storage';
import { ErroApi, nuvem, type UsuarioNuvem } from './lib/nuvem';
import type { Caso, CasoResumo, StatusCaso } from '../shared/registro';
import { LoginView } from './components/LoginView';
import { CasoCabecalho, type EstadoSalvamento } from './components/CasoCabecalho';
import { Abas, Botao } from './components/ui';
import { HistoricoModal } from './components/HistoricoModal';
import { ContaModal } from './components/ContaModal';
import { Download, Plus, X } from 'lucide-react';

type Aba = 'dashboard' | 'sobrestamento' | 'checklist' | 'minuta' | 'precedentes';
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
  const [configAberta, setConfigAberta] = useState(false);
  const [instrucoes, setInstrucoes] = useState(lerInstrucoes);
  const [instrucoesPadrao, setInstrucoesPadrao] = useState<string>();
  const [prazo, setPrazo] = useState<EntradasPrazo>(ENTRADAS_VAZIAS);
  const [baseCustom, setBaseCustom] = useState<EntradaBase[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const alertaRef = useRef<HTMLDivElement | null>(null);

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

  // A mensagem de erro fica no topo da página: traz para a vista quem está no rodapé do formulário.
  useEffect(() => {
    if (errorMessage) alertaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [errorMessage]);
  useEffect(() => salvarConfig(config), [config]);
  useEffect(() => salvarInstrucoes(instrucoes), [instrucoes]);
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
    if (!usuario) return;
    nuvem.base.listar().then(setBaseCustom).catch(sessaoExpirada);
    buscarInstrucoesPadrao().then(setInstrucoesPadrao).catch(() => {});
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

  // Avisa antes de fechar a aba com alterações ainda não gravadas na nuvem.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      const dados = resultRef.current;
      if (!dados || dados.meta?.provedor === 'exemplo') return;
      const pendente = !registroRef.current || JSON.stringify(dados) !== baselineRef.current || ['salvando', 'erro', 'conflito'].includes(salvamentoRef.current.estado);
      if (pendente) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

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
  const pendencias = [
    !temAcordao && 'Anexar o acórdão recorrido',
    !temRecurso && 'Anexar ao menos um recurso',
    !prazo.dataIntimacaoAcordao && 'Informar a intimação do acórdão',
    !prazo.feriadosRespondido && 'Responder sobre feriados e suspensões',
    !temChave && 'Configurar a chave de API do motor de IA',
    extraindo && 'Aguardar a leitura dos PDFs',
    bytesPdf > LIMITES.maxBytesTotal &&
      `Reduzir os PDFs enviados como arquivo: somam ${(bytesPdf / 1048576).toFixed(0)} MB (limite de ${(LIMITES.maxBytesTotal / 1048576).toFixed(0)} MB). Envie como texto os que têm camada de texto.`,
  ].filter((x): x is string => Boolean(x));
  const faltando = pendencias[0] ?? '';

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
        instrucoes,
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

  const avisosSob = useMemo(() => (analysisResult ? avisosSobrestamento(analysisResult) : []), [analysisResult]);

  const abas: Array<{ id: Aba; rotulo: string; contagem?: number; alerta?: boolean }> = [
    { id: 'dashboard', rotulo: 'Diagnóstico' },
    { id: 'sobrestamento', rotulo: 'Sobrestamento', contagem: avisosSob.length || undefined, alerta: avisosSob.length > 0 },
    { id: 'checklist', rotulo: 'Checklist' },
    { id: 'minuta', rotulo: 'Minuta' },
    { id: 'precedentes', rotulo: 'Precedentes', contagem: alertasPrecedentes || undefined, alerta: alertasPrecedentes > 0 },
  ];

  if (autenticando) return <div className="min-h-screen" aria-busy="true" />;
  if (!usuario) return <LoginView onLogin={setUsuario} />;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenConsulta={() => setConsultaAberta(true)}
        onOpenConfig={() => setConfigAberta(true)}
        onHome={() => setConsultaAberta(false)}
        usuarioNome={usuario?.nome}
        onConta={() => setContaAberta(true)}
        onLogout={sair}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 sm:px-8">
        {errorMessage && (
          <div ref={alertaRef} role="alert" className="mb-8 flex scroll-mt-4 items-start justify-between gap-4 border-l-2 border-obice bg-folha py-3 pl-4 pr-2 text-sm text-tinta">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dispensar mensagem" className="rounded p-0.5 text-tinta-3 hover:text-tinta">
              <X className="size-4" />
            </button>
          </div>
        )}

        {securityWarnings.length > 0 && (
          <div role="alert" className="mb-8 border-l-2 border-atencao bg-folha py-3 pl-4 pr-4 text-sm">
            <p className="font-medium text-tinta">Trechos com aparência de instrução à IA foram encontrados nas peças ou notas. Revise a análise com atenção redobrada.</p>
            <ul className="mt-1.5 space-y-0.5 text-[13px] text-tinta-2">
              {securityWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
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
            canAnalyze={!faltando}
            pendencias={pendencias}
            casos={casos}
            buscaCasos={buscaCasos}
            onBuscaCasos={setBuscaCasos}
            onOpenCaso={abrirCasoDaLista}
            onDeleteCaso={excluirCaso}
            podeExcluir={(c) => usuario?.papel === 'admin' || c.criadoPor.id === usuario?.id}
            prazoForm={<PrazoForm value={prazo} onChange={setPrazo} idPrefix="pre" />}
            motor={{ nome: `${nomeMotor(provider).nome} (${nomeMotor(provider).empresa})`, pronto: temChave }}
            onConfigurar={() => setConfigAberta(true)}
          />
        ) : (
          <div>
            <CasoCabecalho
              dados={analysisResult}
              estado={analysisResult.meta?.provedor === 'exemplo' ? 'exemplo' : salvamento.estado}
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

            <div className="sticky top-0 z-30 -mx-4 mb-8 mt-4 border-b border-linha bg-papel/95 px-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <Abas rotulo="Seções da análise" itens={abas} ativa={activeTab} onChange={setActiveTab} />
                <div className="flex shrink-0 items-center gap-1">
                  <Botao tamanho="sm" variante="discreto" onClick={() => setIsPdfModalOpen(true)}>
                    <Download className="size-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Botao>
                  <Botao tamanho="sm" variante="discreto" onClick={handleReset} title="Começar outro exame (este fica gravado nos registros)">
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Novo exame</span>
                  </Botao>
                </div>
              </div>
            </div>

            <div role="tabpanel">
              {activeTab === 'dashboard' && (
                <DashboardOverview
                  data={analysisResult}
                  onChangePrazo={atualizarPrazo}
                  onNavigateToChecklist={() => setActiveTab('checklist')}
                  onNavigateToMinuta={() => setActiveTab('minuta')}
                  onNavigateToSobrestamento={() => setActiveTab('sobrestamento')}
                  onChangePreparo={(preparo) => updateResult((r) => ({ ...r, preparo }))}
                />
              )}

              {activeTab === 'sobrestamento' && (
                <SobrestamentoView
                  valor={obterSobrestamento(analysisResult)}
                  avisos={avisosSob}
                  usuarioNome={usuario?.nome}
                  onChange={(sob) => updateResult((r) => ({ ...r, sobrestamento: sob }))}
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
          </div>
        )}
      </main>

      {configAberta && (
        <ConfiguracoesModal
          onClose={() => setConfigAberta(false)}
          onEsquecerChaves={() => {
            apagarDadosLocais();
            setChaves({});
            setConfig(lerConfig());
          }}
          motor={<EngineSettings config={config} onConfig={setConfig} chaves={chaves} onChaves={setChaves} servidor={servidor} />}
          instrucoes={instrucoes}
          instrucoesPadrao={instrucoesPadrao}
          onInstrucoes={setInstrucoes}
        />
      )}

      {contaAberta && <ContaModal usuario={usuario} onClose={() => setContaAberta(false)} />}
      {histAberto && registro && <HistoricoModal casoId={registro.id} versaoAtual={registro.versao} onClose={() => setHistAberto(false)} onRestaurar={restaurarVersao} />}

      <TechnicalGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {analysisResult && <PDFExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} data={analysisResult} responsavel={usuario?.nome} />}
    </div>
  );
}
