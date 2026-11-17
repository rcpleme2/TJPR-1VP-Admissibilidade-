import { baixar } from './baixar.js';
import { lerEndereco } from './config.js';

const quadro = document.getElementById('app');
const carregando = document.getElementById('carregando');
quadro.addEventListener('load', () => (carregando.hidden = true));
let origemApp = '';
/** Aberto como janela própria (e não no painel lateral)? */
const emJanela = new URLSearchParams(location.search).has('janela');
if (emJanela) document.title = 'Admissibilidade 1ª VP';

function abrir(endereco) {
  origemApp = new URL(endereco).origin;
  if (quadro.src !== endereco) {
    carregando.hidden = false;
    quadro.src = endereco;
  }
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
    // a janela é criada pelo service worker, que a traz para a frente depois que o painel fecha
    const w = await chrome.windows.getCurrent().catch(() => null);
    const r = await chrome.runtime.sendMessage({ tipo: 'abrirJanela', origem: w && { left: w.left, top: w.top, width: w.width, height: w.height } }).catch(() => null);
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

chrome.storage.onChanged.addListener(async (mudancas, area) => {
  if (area === 'sync' && 'enderecoApp' in mudancas) abrir(await lerEndereco());
});

abrir(await lerEndereco());
