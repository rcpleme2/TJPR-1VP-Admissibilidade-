// Clicar no ícone da extensão abre o painel lateral; o menu do ícone (botão direito) abre o sistema numa janela.
const MENU_JANELA = 'abrir-janela';

function configurar() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_JANELA, title: 'Abrir em janela separada', contexts: ['action'] });
  });
}
chrome.runtime.onInstalled.addListener(configurar);
chrome.runtime.onStartup.addListener(configurar);

/** Abre (ou traz para a frente) a janela própria do sistema, no tamanho e posição da última vez. */
async function abrirJanela() {
  const { janelaId } = await chrome.storage.session.get('janelaId');
  if (janelaId) {
    try {
      await chrome.windows.update(janelaId, { focused: true });
      return;
    } catch {
      /* a janela já foi fechada */
    }
  }
  const { limitesJanela } = await chrome.storage.local.get('limitesJanela');
  const w = await chrome.windows.create({
    url: chrome.runtime.getURL('painel.html?janela=1'),
    type: 'popup',
    focused: true,
    ...(limitesJanela ?? { width: 560, height: 900 }),
  });
  await chrome.storage.session.set({ janelaId: w.id });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_JANELA) abrirJanela();
});

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo !== 'abrirJanela') return;
  abrirJanela().then(() => responder({ ok: true }), (e) => responder({ ok: false, erro: String(e?.message || e) }));
  return true;
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
