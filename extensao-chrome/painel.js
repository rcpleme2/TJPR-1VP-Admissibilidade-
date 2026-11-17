import { formularioEndereco, lerEndereco } from './config.js';

const quadro = document.getElementById('app');
const configurar = document.getElementById('configurar');
let origemApp = '';
/** Aberto como janela própria (e não no painel lateral)? */
const emJanela = new URLSearchParams(location.search).has('janela');
if (emJanela) document.title = 'Admissibilidade 1ª VP';

const LIMITE = 60 * 1024 * 1024;

function abrir(endereco) {
  origemApp = new URL(endereco).origin;
  configurar.hidden = true;
  quadro.hidden = false;
  if (quadro.src !== endereco) quadro.src = endereco;
}

function pedirEndereco(atual) {
  quadro.hidden = true;
  configurar.hidden = false;
  formularioEndereco(document.getElementById('form'), atual, abrir);
}

/** Nome do arquivo: Content-Disposition > nome sugerido pelo link > fim do endereço. */
function nomeDoArquivo(resp, url, sugerido) {
  const cd = resp.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i) || cd.match(/filename\s*=\s*"?([^";]+)"?/i);
  let nome = m ? decodeURIComponent(m[1].trim()) : (sugerido || '').trim();
  if (!nome) nome = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || 'documento');
  nome = nome.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 150) || 'documento';
  return /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`;
}

async function baixar(item) {
  const url = new URL(item.url);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Só é possível trazer arquivos de endereços https.');
  const permitido = await chrome.permissions.contains({ origins: [local ? 'http://localhost/*' : `${url.origin}/*`] });
  if (!permitido) throw new Error(`A extensão não tem acesso a ${url.hostname}. Libere o site nas opções da extensão.`);
  // credentials: a sessão que o usuário já tem aberta no site de origem
  const resp = await fetch(url.href, { credentials: 'include', redirect: 'follow' });
  if (resp.status === 401 || resp.status === 403) throw new Error(`O site recusou o download (HTTP ${resp.status}). Confira se você está logado nele.`);
  if (!resp.ok) throw new Error(`O site respondeu com erro (HTTP ${resp.status}).`);
  const tamanho = Number(resp.headers.get('content-length') || 0);
  if (tamanho > LIMITE) throw new Error('Arquivo com mais de 60 MB.');
  const dados = await resp.arrayBuffer();
  const inicio = new TextDecoder('latin1').decode(new Uint8Array(dados.slice(0, 1024)));
  if (!inicio.includes('%PDF-')) {
    throw new Error('O link não leva direto a um PDF (abre uma página). Abra o documento e arraste o link de download, ou baixe o arquivo e arraste-o.');
  }
  return { nome: nomeDoArquivo(resp, url.href, item.nome), dados };
}

// Ponte com o sistema: ele pede os links soltos no painel; a extensão baixa e devolve o PDF.
window.addEventListener('message', async (e) => {
  if (e.source !== quadro.contentWindow || e.origin !== origemApp) return;
  const msg = e.data;
  // o sistema pergunta onde está aberto, para mostrar (ou não) o botão de abrir em janela
  if (msg?.tipo === 'tjpr:ola') {
    quadro.contentWindow.postMessage({ tipo: 'tjpr:modo', modo: emJanela ? 'janela' : 'painel' }, origemApp);
    return;
  }
  // passa do painel lateral para uma janela própria
  if (msg?.tipo === 'tjpr:janela') {
    const r = await chrome.runtime.sendMessage({ tipo: 'abrirJanela' }).catch(() => null);
    if (r?.ok && !emJanela) window.close();
    return;
  }
  if (!msg || msg.tipo !== 'tjpr:baixar' || !Array.isArray(msg.itens)) return;
  for (const item of msg.itens.slice(0, 12)) {
    try {
      const { nome, dados } = await baixar(item);
      quadro.contentWindow.postMessage({ tipo: 'tjpr:arquivo', id: item.id, nome, dados }, origemApp, [dados]);
    } catch (err) {
      quadro.contentWindow.postMessage({ tipo: 'tjpr:erro', id: item.id, url: item.url, mensagem: err.message || 'Falha ao baixar o arquivo.' }, origemApp);
    }
  }
});

chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === 'sync' && mudancas.enderecoApp?.newValue) abrir(mudancas.enderecoApp.newValue);
});

const atual = await lerEndereco();
if (atual) abrir(atual);
else pedirEndereco('');
