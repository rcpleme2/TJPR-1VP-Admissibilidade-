import { formularioEndereco, lerEndereco, liberarSite, revogarSite, sitesExtras } from './config.js';

const ok = document.querySelector('.ok');
formularioEndereco(document.getElementById('form'), await lerEndereco(), () => {
  ok.hidden = false;
  listar();
});

const lista = document.getElementById('sites');
async function listar() {
  const sites = await sitesExtras();
  lista.innerHTML = '';
  for (const origem of ['https://*.jus.br/*', ...sites]) {
    const li = document.createElement('li');
    const nome = document.createElement('span');
    nome.textContent = origem.replace(/\/\*$/, '');
    li.append(nome);
    if (origem !== 'https://*.jus.br/*') {
      const b = document.createElement('button');
      b.className = 'discreto';
      b.textContent = 'Remover';
      b.addEventListener('click', async () => {
        await revogarSite(origem);
        listar();
      });
      li.append(b);
    }
    lista.append(li);
  }
}
listar();

const form = document.getElementById('novo-site');
const erro = form.querySelector('.erro');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro.hidden = true;
  try {
    await liberarSite(document.getElementById('site').value);
    form.reset();
    listar();
  } catch (err) {
    erro.textContent = err.message;
    erro.hidden = false;
  }
});
