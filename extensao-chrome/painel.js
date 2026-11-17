import { baixar } from './baixar.js';
import { formularioEndereco, lerEndereco } from './config.js';

const quadro = document.getElementById('app');
const configurar = document.getElementById('configurar');
let origemApp = '';
/** Aberto como janela própria (e não no painel lateral)? */
const emJanela = new URLSearchParams(location.search).has('janela');
if (emJanela) document.title = 'Admissibilidade 1ª VP';

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
