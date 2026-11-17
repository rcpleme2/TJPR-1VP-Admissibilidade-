# Extensão do Chrome: Admissibilidade 1ª VP

Abre o sistema de admissibilidade no painel lateral do Chrome. Com o painel aberto ao lado do Projudi
(ou de outro site do Judiciário), basta arrastar o link do documento para o painel: a extensão baixa o
PDF com a sessão que você já tem no site e o anexa ao exame.

## Instalação

1. Baixe a versão mais recente pelo próprio sistema (cabeçalho: **Extensão**, ou Configurações > Extensão do Chrome).
2. Descompacte numa pasta fixa.
3. Em `chrome://extensions`, ligue o **Modo do desenvolvedor** e clique em **Carregar sem compactação**, escolhendo a pasta.
4. Clique no ícone da extensão e informe o endereço do sistema. O Chrome pede permissão para acessá-lo.

Para atualizar: baixe de novo, substitua o conteúdo da pasta e clique em **Recarregar** em `chrome://extensions`.

## Painel lateral ou janela própria

No painel, o botão de janela no cabeçalho do sistema (ou o item **Abrir em janela separada** no menu do
ícone da extensão, com o botão direito) passa o sistema para uma janela própria, que pode ficar em outro
monitor. A janela guarda tamanho e posição; para voltar ao painel, feche-a e clique no ícone da extensão.
Ao trocar de painel para janela o sistema é recarregado: salve o registro antes.

## Como funciona

- `painel.html` abre o sistema num iframe. O servidor só aceita ser embutido pela extensão cujo ID está em
  `EXTENSAO_CHROME_IDS` (padrão: `abcgfjjfopdbldinmjmaogemajfifkpf`, fixado pela chave pública em `manifest.json`).
- Ao soltar um link no painel, o sistema pede o arquivo à extensão (`postMessage`); a extensão baixa o
  endereço com `fetch` (credenciais do site de origem), confere se é PDF e devolve os bytes.
- Sites `*.jus.br` vêm liberados. Outros sites podem ser liberados nas opções da extensão.
- Links que abrem uma página de visualização (e não o PDF em si) não podem ser baixados assim: nesse caso,
  arraste o link de download ou baixe o arquivo e arraste-o.

## Publicação na Chrome Web Store

A loja atribui outro ID à extensão. Ao publicar, retire o campo `key` do manifest e informe o novo ID na
variável de ambiente `EXTENSAO_CHROME_IDS` do servidor (aceita vários, separados por vírgula).
