// Clicar no ícone da extensão abre o painel lateral; o menu do ícone (botão direito) abre o sistema numa janela.
// Nas abas comuns do sistema, a extensão injeta ponte.js para trazer PDFs arrastados de outros sites.
import { baixar, LIMITE } from './baixar.js';
import { lerEndereco, padrao } from './config.js';

const MENU_JANELA = 'abrir-janela';

/** Injeta ponte.js nas abas do sistema (endereço configurado). */
async function registrarPonte() {
  await chrome.scripting.unregisterContentScripts({ ids: ['ponte'] }).catch(() => {});
  const endereco = await lerEndereco();
  if (!endereco) return;
  const origem = new URL(endereco).origin;
  if (!(await chrome.permissions.contains({ origins: [padrao(origem)] }))) return;
  await chrome.scripting
    .registerContentScripts([{ id: 'ponte', js: ['ponte.js'], matches: [padrao(origem)], runAt: 'document_start', allFrames: false }])
    .catch(() => {});
}

function configurar() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_JANELA, title: 'Abrir em janela separada', contexts: ['action'] });
  });
  registrarPonte();
}
chrome.runtime.onInstalled.addListener(configurar);
chrome.runtime.onStartup.addListener(configurar);
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === 'sync' && 'enderecoApp' in mudancas) registrarPonte();
});
chrome.permissions.onAdded.addListener(registrarPonte);

/** Mensagens da extensão levam só texto: o PDF vai em base64 (limite de 64 MB por mensagem). */
const LIMITE_PONTE = Math.min(LIMITE, 45 * 1024 * 1024);
function paraBase64(buf) {
  const u8 = new Uint8Array(buf);
  if (u8.toBase64) return u8.toBase64();
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Pedido de ponte.js: só aceito de abas do sistema. */
async function baixarParaAba(item, remetente) {
  const endereco = await lerEndereco();
  if (!endereco || !remetente.url || new URL(remetente.url).origin !== new URL(endereco).origin) throw new Error('Pedido de origem não autorizada.');
  const { nome, dados } = await baixar(item);
  if (dados.byteLength > LIMITE_PONTE) throw new Error('Arquivo grande demais para trazer pela aba: use o painel lateral ou baixe o arquivo e arraste-o.');
  return { nome, base64: paraBase64(dados) };
}

const LARGURA = 560;

/** Traz a janela para a frente. Repetido depois de um instante: ao fechar, o painel lateral devolve o foco à janela do navegador. */
function trazerParaFrente(id) {
  const focar = () => chrome.windows.update(id, { focused: true, drawAttention: true, state: 'normal' }).catch(() => {});
  focar();
  setTimeout(focar, 350);
  setTimeout(focar, 900);
}

/** Posição da janela: a da última vez, se ainda couber na tela; senão, encostada à direita da janela do navegador. */
async function limites(origem) {
  const { limitesJanela } = await chrome.storage.local.get('limitesJanela');
  if (limitesJanela?.width >= 320 && limitesJanela?.height >= 400) return limitesJanela;
  const base = origem ?? (await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null));
  if (!base?.width) return { width: LARGURA, height: 900 };
  const width = Math.min(LARGURA, base.width);
  return { left: base.left + base.width - width, top: base.top, width, height: base.height };
}

/** Abre (ou traz para a frente) a janela própria do sistema. */
async function abrirJanela(origem) {
  const { janelaId } = await chrome.storage.session.get('janelaId');
  if (janelaId) {
    const existe = await chrome.windows.get(janelaId).catch(() => null);
    if (existe) {
      trazerParaFrente(janelaId);
      return;
    }
  }
  let w;
  try {
    w = await chrome.windows.create({ url: chrome.runtime.getURL('painel.html?janela=1'), type: 'popup', focused: true, ...(await limites(origem)) });
  } catch {
    // posição salva fora da tela (ex.: monitor desconectado): abre no tamanho padrão
    await chrome.storage.local.remove('limitesJanela');
    w = await chrome.windows.create({ url: chrome.runtime.getURL('painel.html?janela=1'), type: 'popup', focused: true, width: LARGURA, height: 900 });
  }
  await chrome.storage.session.set({ janelaId: w.id });
  trazerParaFrente(w.id);
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_JANELA) abrirJanela();
});

chrome.runtime.onMessage.addListener((msg, remetente, responder) => {
  if (remetente.id !== chrome.runtime.id) return;
  if (msg?.tipo === 'abrirJanela') {
    abrirJanela(msg.origem).then(() => responder({ ok: true }), (e) => responder({ ok: false, erro: String(e?.message || e) }));
    return true;
  }
  if (msg?.tipo === 'baixarLink' && msg.item?.url) {
    baixarParaAba(msg.item, remetente).then(
      (r) => responder({ ok: true, ...r }),
      (e) => responder({ ok: false, erro: e?.message || 'Falha ao baixar o arquivo.' }),
    );
    return true;
  }
});

// Guarda tamanho e posição da janela para a próxima vez.
chrome.windows.onBoundsChanged.addListener(async (w) => {
  const { janelaId } = await chrome.storage.session.get('janelaId');
  if (w.id !== janelaId || w.state !== 'normal') return;
  await chrome.storage.local.set({ limitesJanela: { left: w.left, top: w.top, width: w.width, height: w.height } });
});

chrome.windows.onRemoved.addListener(async (id) => {
  const { janelaId } = await chrome.storage.session.get('janelaId');
  if (id === janelaId) await chrome.storage.session.remove('janelaId');
});
