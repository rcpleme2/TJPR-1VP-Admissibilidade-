/**
 * Links de PDFs arrastados de outros sites (ex.: Projudi). Com a extensão do Chrome (painel lateral, janela própria
 * ou aba comum), quem baixa é a extensão, com a sessão que o usuário já tem no site de origem, e o PDF volta por
 * postMessage. Sem ela, o servidor baixa o link (só links públicos).
 */

import { useEffect, useState } from 'react';

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

/**
 * Canal com a extensão: no painel/janela da extensão, a página que embute o sistema; numa aba comum, o script que a
 * extensão (1.2.0 ou mais nova) injeta nesta página, que marca o <html> com data-tjpr-ponte.
 */
function canalExtensao(): { alvo: Window; origem: string } | null {
  const origem = origemDaExtensao();
  if (origem) return { alvo: window.parent, origem };
  if (document.documentElement.dataset.tjprPonte) return { alvo: window, origem: window.location.origin };
  return null;
}

/** A extensão pode baixar links (com a sessão do usuário no site de origem)? */
export const extensaoDisponivel = () => canalExtensao() !== null;

function ouvir(canal: { alvo: Window; origem: string }) {
  if (ouvindo) return;
  ouvindo = true;
  window.addEventListener('message', (e) => {
    if (e.origin !== canal.origem || e.source !== canal.alvo) return;
    const msg = e.data as { tipo?: string; id?: string; nome?: string; dados?: ArrayBuffer; mensagem?: string };
    if (msg?.tipo !== 'tjpr:arquivo' && msg?.tipo !== 'tjpr:erro') return;
    const p = msg.id ? pendentes.get(msg.id) : undefined;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendentes.delete(msg.id!);
    if (msg.tipo === 'tjpr:arquivo' && msg.dados instanceof ArrayBuffer) p.resolve(new File([msg.dados], msg.nome || 'documento.pdf', { type: 'application/pdf' }));
    else p.reject(new Error(msg.mensagem || 'A extensão não conseguiu baixar o arquivo.'));
  });
}

/** Sem a extensão, o servidor baixa o link (só links públicos: ele não tem a sessão do usuário no site de origem). */
async function baixarPeloServidor(link: LinkArrastado): Promise<File> {
  const r = await fetch('/api/baixar-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
    body: JSON.stringify({ url: link.url, nome: link.nome }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Falha ao baixar o arquivo (HTTP ${r.status}).`);
  }
  const nome = decodeURIComponent(r.headers.get('x-nome-arquivo') || '') || 'documento.pdf';
  return new File([await r.arrayBuffer()], nome, { type: 'application/pdf' });
}

/** Traz os PDFs dos links arrastados: pela extensão, se houver (painel, janela ou aba comum); senão, pelo servidor. */
export function trazerLinks(links: LinkArrastado[]): Array<{ link: LinkArrastado; arquivo: Promise<File> }> {
  const canal = canalExtensao();
  if (!canal) return links.map((link) => ({ link, arquivo: baixarPeloServidor(link) }));
  ouvir(canal);
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
  canal.alvo.postMessage({ tipo: 'tjpr:baixar', itens: itens.map(({ id, url, nome }) => ({ id, url, nome })) }, canal.origem);
  return out;
}

export type ModoExtensao = 'painel' | 'janela';

/** Onde a extensão abriu o sistema (painel lateral ou janela própria); null fora da extensão ou em versão antiga dela. */
export function useModoExtensao(): ModoExtensao | null {
  const [modo, setModo] = useState<ModoExtensao | null>(null);
  useEffect(() => {
    const origem = origemDaExtensao();
    if (!origem) return;
    const aoReceber = (e: MessageEvent) => {
      if (e.origin !== origem || e.source !== window.parent) return;
      const m = e.data as { tipo?: string; modo?: string };
      if (m?.tipo === 'tjpr:modo' && (m.modo === 'painel' || m.modo === 'janela')) setModo(m.modo);
    };
    window.addEventListener('message', aoReceber);
    window.parent.postMessage({ tipo: 'tjpr:ola' }, origem);
    return () => window.removeEventListener('message', aoReceber);
  }, []);
  return modo;
}

/** Pede à extensão que passe o sistema do painel lateral para uma janela própria. */
export function abrirEmJanela() {
  const origem = origemDaExtensao();
  if (origem) window.parent.postMessage({ tipo: 'tjpr:janela' }, origem);
}
