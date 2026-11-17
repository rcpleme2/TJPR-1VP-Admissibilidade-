/**
 * Integração com a extensão do Chrome (extensao-chrome/): o sistema aberto no painel lateral recebe
 * links de PDFs arrastados de outros sites (ex.: Projudi). Quem baixa é a extensão, com a sessão que o
 * usuário já tem no site de origem; o PDF volta para cá por postMessage.
 */

export const URL_EXTENSAO = '/extensao-admissibilidade.zip';
export const VERSAO_EXTENSAO = typeof __VERSAO_EXTENSAO__ !== 'undefined' ? __VERSAO_EXTENSAO__ : '';

/** Origem da extensão, se o sistema estiver aberto dentro dela. */
export function origemDaExtensao(): string | null {
  if (window.parent === window) return null;
  const origem = window.location.ancestorOrigins?.[0];
  return origem && origem.startsWith('chrome-extension://') ? origem : null;
}

export interface LinkArrastado {
  url: string;
  nome?: string;
}

/** Links soltos no painel: lê o HTML (para pegar o texto do link) e, na falta, a lista de URLs. */
export function linksArrastados(dt: DataTransfer): LinkArrastado[] {
  const vistos = new Set<string>();
  const out: LinkArrastado[] = [];
  const add = (url: string, nome?: string) => {
    try {
      const u = new URL(url, window.location.href);
      if (!/^https?:$/.test(u.protocol) || vistos.has(u.href)) return;
      vistos.add(u.href);
      out.push({ url: u.href, nome: nome?.replace(/\s+/g, ' ').trim() || undefined });
    } catch {
      /* endereço inválido */
    }
  };
  const html = dt.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a[href]').forEach((a) => add(a.getAttribute('href')!, a.textContent ?? undefined));
  }
  if (out.length === 0) {
    dt.getData('text/uri-list')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#'))
      .forEach((l) => add(l.trim()));
  }
  return out;
}

export const temLinks = (dt: DataTransfer | null) => Boolean(dt?.types.includes('text/uri-list'));
export const temArquivos = (dt: DataTransfer | null) => Boolean(dt?.types.includes('Files'));

type Pendente = { resolve: (f: File) => void; reject: (e: Error) => void; timer: number };
const pendentes = new Map<string, Pendente>();
let ouvindo = false;

function ouvir(origem: string) {
  if (ouvindo) return;
  ouvindo = true;
  window.addEventListener('message', (e) => {
    if (e.origin !== origem || e.source !== window.parent) return;
    const msg = e.data as { tipo?: string; id?: string; nome?: string; dados?: ArrayBuffer; mensagem?: string };
    const p = msg?.id ? pendentes.get(msg.id) : undefined;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendentes.delete(msg.id!);
    if (msg.tipo === 'tjpr:arquivo' && msg.dados instanceof ArrayBuffer) p.resolve(new File([msg.dados], msg.nome || 'documento.pdf', { type: 'application/pdf' }));
    else p.reject(new Error(msg.mensagem || 'A extensão não conseguiu baixar o arquivo.'));
  });
}

/** Pede à extensão que baixe os links; cada arquivo chega por uma promessa própria. */
export function baixarPelaExtensao(links: LinkArrastado[]): Array<{ link: LinkArrastado; arquivo: Promise<File> }> {
  const origem = origemDaExtensao();
  if (!origem) throw new Error('Fora da extensão do Chrome.');
  ouvir(origem);
  const itens = links.map((link) => ({ ...link, id: crypto.randomUUID() }));
  const out = itens.map((it) => ({
    link: it,
    arquivo: new Promise<File>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendentes.delete(it.id);
        reject(new Error('O download pela extensão demorou demais.'));
      }, 120_000);
      pendentes.set(it.id, { resolve, reject, timer });
    }),
  }));
  window.parent.postMessage({ tipo: 'tjpr:baixar', itens: itens.map(({ id, url, nome }) => ({ id, url, nome })) }, origem);
  return out;
}
