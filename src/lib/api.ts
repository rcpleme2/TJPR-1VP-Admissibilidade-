import type { AdmissibilityAnalysisResult, Provedor, UploadedFileItem } from '../types/admissibility';

export interface ConfigServidor {
  authRequired: boolean;
  serverKeys: Provedor[];
  modelosPadrao: Record<Provedor, string>;
  limites: { maxArquivos: number; maxBytesTotal: number };
}

export async function buscarConfig(): Promise<ConfigServidor | null> {
  try {
    const r = await fetch('/api/config');
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const cabecalhos = (token: string): Record<string, string> => (token ? { 'x-access-token': token } : {});

async function erroDaResposta(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (j?.error) return j.error;
  } catch {
    /* corpo não JSON */
  }
  if (res.status === 401) return 'Token de acesso ausente ou inválido.';
  if (res.status === 413) return 'Arquivos grandes demais para enviar.';
  if (res.status === 429) return 'Muitas análises em pouco tempo. Aguarde alguns minutos.';
  return `Falha na comunicação com o servidor (HTTP ${res.status}).`;
}

export async function carregarExemplo(token: string): Promise<AdmissibilityAnalysisResult> {
  const res = await fetch('/api/sample-case', { headers: cabecalhos(token) });
  if (!res.ok) throw new Error(await erroDaResposta(res));
  const json = await res.json();
  if (!json.data) throw new Error('Falha ao carregar o caso simulado.');
  return json.data;
}

export interface ParametrosAnalise {
  provider: Provedor;
  model?: string;
  apiKey?: string;
  token: string;
  files: UploadedFileItem[];
  appealType: string;
  notes: string;
  signal: AbortSignal;
  onStage: (mensagem: string) => void;
}

/** Lê a resposta NDJSON do servidor: etapas reais de progresso e o resultado final. */
export async function analisar(p: ParametrosAnalise): Promise<{ data: AdmissibilityAnalysisResult; securityWarnings: string[] }> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...cabecalhos(p.token),
      ...(p.apiKey ? { 'x-llm-api-key': p.apiKey } : {}),
    },
    body: JSON.stringify({
      provider: p.provider,
      model: p.model || undefined,
      appealType: p.appealType,
      notes: p.notes,
      confirmaUsoAutorizado: true,
      files: p.files.map((f) => ({
        name: f.name,
        role: f.role,
        mimeType: f.dataBase64 ? 'application/pdf' : 'text/plain',
        dataBase64: f.dataBase64 || undefined,
        textPreview: f.textPreview || undefined,
      })),
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
