/**
 * Download de um PDF por link, feito pelo servidor: é o caminho quando o sistema está aberto no navegador sem a extensão
 * do Chrome. Só serve para links públicos (o servidor não tem a sessão do usuário no site de origem).
 *
 * Proteção contra SSRF: só https na porta padrão, e cada endereço resolvido (também nos redirecionamentos) é conferido
 * na hora da conexão: nada de rede interna, loopback, link-local ou metadados da nuvem.
 */
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import type { IncomingMessage } from 'node:http';

export const LIMITE_BYTES_LINK = 30 * 1024 * 1024;
const TEMPO_MS = 30_000;
const MAX_REDIRECIONAMENTOS = 5;

export class ErroLink extends Error {}

/** Endereço IP de uso interno (não pode ser acessado pelo servidor a pedido do usuário)? */
export function ipInterno(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapeado = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return ipInterno(mapeado[1]);
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return true;
}

/** Valida o endereço antes de pedir: só https, sem usuário/senha, sem porta fora do padrão, sem IP interno literal. */
export function validarUrl(texto: string): URL {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    throw new ErroLink('Endereço inválido.');
  }
  if (u.protocol !== 'https:') throw new ErroLink('Só é possível trazer arquivos de endereços https.');
  if (u.username || u.password) throw new ErroLink('Endereço com usuário e senha não é aceito.');
  if (u.port && u.port !== '443') throw new ErroLink('Endereço com porta fora do padrão não é aceito.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && ipInterno(host)) throw new ErroLink('Endereço interno não é aceito.');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new ErroLink('Endereço interno não é aceito.');
  return u;
}

/** DNS que recusa endereços internos: aplicado na conexão, vale também contra DNS rebinding. */
const lookupSeguro: net.LookupFunction = (host, opcoes, cb) => {
  dns.lookup(host, { ...opcoes, all: true }, (err, enderecos) => {
    if (err) return cb(err, '', 4);
    const lista = enderecos as unknown as dns.LookupAddress[];
    const ruim = lista.find((e) => ipInterno(e.address));
    if (ruim || lista.length === 0) return cb(new ErroLink('Endereço interno não é aceito.'), '', 4);
    if ((opcoes as { all?: boolean }).all) return (cb as unknown as (e: null, l: dns.LookupAddress[]) => void)(null, lista);
    cb(null, lista[0].address, lista[0].family);
  });
};

function pedir(u: URL): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(u, { lookup: lookupSeguro, timeout: TEMPO_MS, headers: { 'user-agent': 'Mozilla/5.0 (Admissibilidade 1VP)', accept: 'application/pdf,*/*' } }, resolve);
    req.on('timeout', () => req.destroy(new ErroLink('O site demorou demais para responder.')));
    req.on('error', reject);
  });
}

function nomeDoArquivo(res: IncomingMessage, u: URL, sugerido?: string): string {
  const cd = String(res.headers['content-disposition'] ?? '');
  const m = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i) || cd.match(/filename\s*=\s*"?([^";]+)"?/i);
  let nome = '';
  try {
    nome = m ? decodeURIComponent(m[1].trim()) : (sugerido ?? '').trim();
    if (!nome) nome = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    /* nome mal codificado */
  }
  nome = nome.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 150) || 'documento';
  return /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`;
}

export async function baixarLink(endereco: string, sugerido?: string): Promise<{ nome: string; dados: Buffer }> {
  let u = validarUrl(endereco);
  for (let i = 0; ; i++) {
    let res: IncomingMessage;
    try {
      res = await pedir(u);
    } catch (e) {
      if (e instanceof ErroLink) throw e;
      throw new ErroLink(`Não foi possível acessar ${u.hostname}.`);
    }
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (i >= MAX_REDIRECIONAMENTOS) throw new ErroLink('Redirecionamentos demais.');
      u = validarUrl(new URL(res.headers.location, u).href);
      continue;
    }
    if (status === 401 || status === 403) {
      res.resume();
      throw new ErroLink(`O site exige login (HTTP ${status}). Sem a extensão do Chrome, só links públicos podem ser trazidos: baixe o PDF e arraste o arquivo.`);
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new ErroLink(`O site respondeu com erro (HTTP ${status}).`);
    }
    if (Number(res.headers['content-length'] || 0) > LIMITE_BYTES_LINK) {
      res.destroy();
      throw new ErroLink('Arquivo com mais de 30 MB.');
    }
    const partes: Buffer[] = [];
    let total = 0;
    for await (const parte of res) {
      total += (parte as Buffer).length;
      if (total > LIMITE_BYTES_LINK) {
        res.destroy();
        throw new ErroLink('Arquivo com mais de 30 MB.');
      }
      partes.push(parte as Buffer);
    }
    const dados = Buffer.concat(partes);
    if (!dados.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      throw new ErroLink(
        'O link não leva direto a um PDF público (abre uma página ou pede login). Com a extensão do Chrome os links do Projudi funcionam; sem ela, baixe o PDF e arraste o arquivo.',
      );
    }
    return { nome: nomeDoArquivo(res, u, sugerido), dados };
  }
}
