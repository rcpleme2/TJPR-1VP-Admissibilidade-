// Script que a extensão injeta nas abas do sistema (fora do painel lateral): permite arrastar links de PDFs de outros
// sites (ex.: Projudi) para a página aberta no navegador. Quem baixa é o service worker da extensão, com a sessão que
// o usuário já tem no site de origem; o PDF volta para a página por postMessage.
(() => {
  // a página sabe que a ponte existe por este atributo
  document.documentElement.dataset.tjprPonte = '1';

  const paraBytes = (b64) => {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(b64);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  };

  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.tipo !== 'tjpr:baixar' || !Array.isArray(msg.itens)) return;
    for (const item of msg.itens.slice(0, 12)) {
      let r;
      try {
        r = await chrome.runtime.sendMessage({ tipo: 'baixarLink', item: { url: String(item.url), nome: item.nome ? String(item.nome) : undefined } });
      } catch {
        r = { ok: false, erro: 'A extensão foi atualizada ou recarregada: recarregue esta página.' };
      }
      if (r?.ok) {
        const dados = paraBytes(r.base64).buffer;
        window.postMessage({ tipo: 'tjpr:arquivo', id: item.id, nome: r.nome, dados }, location.origin, [dados]);
      } else {
        window.postMessage({ tipo: 'tjpr:erro', id: item.id, url: item.url, mensagem: r?.erro || 'Falha ao baixar o arquivo.' }, location.origin);
      }
    }
  });
})();
