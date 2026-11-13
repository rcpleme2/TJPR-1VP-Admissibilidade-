import type { AdmissibilityAnalysisResult, EntradasPrazo, Provedor, UploadedFileItem } from '../types/admissibility';

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface ConfigServidor {
  autenticacao: boolean;
  serverKeys: Provedor[];
  modelosPadrao: Record<Provedor, string>;
  limites: { maxArquivos: number; maxBytesTotal: number };
}

export async function buscarInstrucoesPadrao(): Promise<string> {
  const r = await fetch('/api/instrucoes-padrao', { headers: { 'x-requested-with': 'fetch' } });
  if (!r.ok) throw new Error(await erroDaResposta(r));
  return (await r.json()).instrucoes ?? '';
}

export interface ModeloDisponivel {
  id: string;
  nome: string;
}

/** Consulta, com a chave informada (ou a do servidor), os modelos disponíveis no provedor. */
export async function listarModelos(provider: Provedor, apiKey?: string): Promise<ModeloDisponivel[]> {
  const res = await fetch('/api/modelos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-requested-with': 'fetch', ...(apiKey ? { 'x-llm-api-key': apiKey } : {}) },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error(await erroDaResposta(res));
  return (await res.json()).modelos ?? [];
}

export async function buscarConfig(): Promise<ConfigServidor | null> {
  try {
    const r = await fetch('/api/config');
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function erroDaResposta(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j?.error) return j.error;
  } catch {
    /* corpo não JSON */
  }
  if (res.status === 401) return 'Sessão expirada. Entre novamente.';
  if (res.status === 413) return 'Arquivos grandes demais para enviar.';
  if (res.status === 429) return 'Muitas análises em pouco tempo. Aguarde alguns minutos.';
  return `Falha na comunicação com o servidor (HTTP ${res.status}).`;
}

export async function carregarExemplo(): Promise<AdmissibilityAnalysisResult> {
  const res = await fetch('/api/sample-case');
  if (!res.ok) throw new Error(await erroDaResposta(res));
  const json = await res.json();
  if (!json.data) throw new Error('Falha ao carregar o caso simulado.');
  return json.data;
}

export interface ParametrosAnalise {
  provider: Provedor;
  model?: string;
  apiKey?: string;
  files: UploadedFileItem[];
  appealType: string;
  notes: string;
  instrucoes?: string;
  prazo: EntradasPrazo;
  signal: AbortSignal;
  onStage: (mensagem: string) => void;
}

/** Lê a resposta NDJSON do servidor: etapas reais de progresso e o resultado final. */
export async function analisar(p: ParametrosAnalise): Promise<{ data: AdmissibilityAnalysisResult; securityWarnings: string[] }> {
  // PDFs só são lidos e codificados agora, e apenas os enviados no modo "PDF original".
  const arquivos = await Promise.all(
    p.files.map(async (f) =>
      f.modo === 'pdf' && f.arquivo
        ? { name: f.name, role: f.role, mimeType: 'application/pdf' as const, dataBase64: await arquivoParaBase64(f.arquivo), paginas: f.paginas }
        : { name: f.name, role: f.role, mimeType: 'text/plain' as const, textPreview: f.textPreview ?? '', paginas: f.paginas },
    ),
  );
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-requested-with': 'fetch',
      ...(p.apiKey ? { 'x-llm-api-key': p.apiKey } : {}),
    },
    body: JSON.stringify({
      provider: p.provider,
      model: p.model || undefined,
      appealType: p.appealType,
      notes: p.notes,
      instrucoes: p.instrucoes || undefined,
      prazo: p.prazo,
      files: arquivos,
    }),
    signal: p.signal,
  });
  if (!res.ok || !res.body) throw new Error(await erroDaResposta(res));

  const leitor = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let final: { data: AdmissibilityAnalysisResult; securityWarnings: string[] } | null = null;

  const processar = (linha: string) => {
    if (!linha.trim()) return;
    const msg = JSON.parse(linha);
    if (msg.type === 'stage') p.onStage(msg.mensagem);
    else if (msg.type === 'error') throw new Error(msg.error);
    else if (msg.type === 'result') final = { data: msg.data, securityWarnings: msg.securityWarnings ?? [] };
  };

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) {
      processar(buffer.slice(0, i));
      buffer = buffer.slice(i + 1);
    }
  }
  processar(buffer);
  if (!final) throw new Error('A conexão foi encerrada antes do resultado. Tente novamente.');
  return final;
}
