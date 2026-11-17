// Configuração compartilhada pelo painel e pela página de opções.

export async function lerEndereco() {
  const { enderecoApp } = await chrome.storage.sync.get({ enderecoApp: '' });
  return enderecoApp;
}

/** Normaliza o endereço digitado: só https (ou http em localhost), sem caminho extra. */
export function normalizar(texto) {
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(texto.trim()) ? texto.trim() : `https://${texto.trim()}`);
  } catch {
    return null;
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
  return `${u.origin}/`;
}

export const padrao = (origem) => (origem.startsWith('http://localhost') || origem.startsWith('http://127.0.0.1') ? 'http://localhost/*' : `${origem}/*`);

/** Grava o endereço e pede acesso a ele (necessário para a sessão funcionar dentro do painel). */
export async function salvarEndereco(endereco) {
  const origem = new URL(endereco).origin;
  const ok = await chrome.permissions.request({ origins: [padrao(origem)] });
  if (!ok) throw new Error('Sem a permissão de acesso ao endereço, o login não funciona dentro do painel.');
  await chrome.storage.sync.set({ enderecoApp: endereco });
}

/** Sites de onde os PDFs podem ser arrastados (além dos *.jus.br, liberados na instalação). */
export async function sitesExtras() {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((o) => o !== 'https://*.jus.br/*');
}

export async function liberarSite(texto) {
  const end = normalizar(texto);
  if (!end) throw new Error('Endereço inválido. Use um endereço https.');
  const ok = await chrome.permissions.request({ origins: [padrao(new URL(end).origin)] });
  if (!ok) throw new Error('Permissão não concedida.');
}

export async function revogarSite(origem) {
  await chrome.permissions.remove({ origins: [origem] });
}

/** Monta o formulário de endereço do sistema em `raiz`. */
export function formularioEndereco(raiz, atual, aoSalvar) {
  raiz.innerHTML = `
    <form class="form" novalidate>
      <label for="endereco">Endereço do sistema</label>
      <input id="endereco" type="url" inputmode="url" autocomplete="url" placeholder="https://admissibilidade-1vp-....run.app" required>
      <p class="ajuda">O mesmo endereço que você abre no navegador. O Chrome vai pedir permissão para a extensão acessá-lo.</p>
      <p class="erro" role="alert" hidden></p>
      <button type="submit">Salvar e abrir</button>
    </form>`;
  const form = raiz.querySelector('form');
  const campo = raiz.querySelector('#endereco');
  const erro = raiz.querySelector('.erro');
  campo.value = atual || '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.hidden = true;
    const end = normalizar(campo.value);
    if (!end) {
      erro.textContent = 'Endereço inválido. Use um endereço https.';
      erro.hidden = false;
      return;
    }
    try {
      await salvarEndereco(end);
      aoSalvar?.(end);
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    }
  });
}
