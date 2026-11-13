# Admissibilidade Recursal – TJPR 1ª Vice-Presidência

Triagem assistida por IA de Recursos Especiais e Extraordinários: extrai dados dos autos, preenche o checklist A–J,
recalcula prazos em código, verifica as súmulas/temas citados e gera uma **minuta-rascunho** (editável, exportável em PDF e Word).

> A saída é rascunho de apoio. Toda minuta, data e citação deve ser conferida por humano antes de qualquer uso.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:8080 (Vite + API no mesmo processo)
npm test           # vitest
npm run lint       # tsc --noEmit
npm run build && npm start   # versão de produção
```

Não é preciso `.env`: cada usuário escolhe o motor e cola a própria chave na tela. Variáveis opcionais em `.env.example`.

## Registros na nuvem (multiusuário)

Cada análise gera um **registro por processo** (chave: número CNJ, com dígito verificador validado) que a equipe compartilha.

- **O que é gravado:** só os dados extraídos, calculados e cadastrados: partes e datas, recursos, checklist e anotações, diagnóstico, minuta
  editada, entradas de prazo (intimação, feriados, interposição), verificação e conferência de precedentes. **Nunca** PDFs, texto integral das
  peças nem base64: o schema descarta campos desconhecidos e o servidor impõe teto de 900 KB por registro.
- **Consistência:** os campos derivados (prazos e verificação de precedentes) são **recalculados no servidor** a cada gravação, com a base de
  súmulas compartilhada; controle de versão otimista (edição concorrente gera aviso de conflito, sem perder dados); um registro por processo;
  salvar sem alteração não cria versão.
- **Histórico:** cada versão guarda autor, data, resumo das mudanças e o conteúdo (últimas 50); qualquer versão pode ser restaurada.
- **Usuários:** login por e-mail e senha (scrypt), sessão em cookie HttpOnly/SameSite=Strict, papéis `admin` e `assessor`, desativação de contas.
  Todos os usuários veem e editam os registros; excluir é do autor ou de um admin. Admin gerencia usuários em "Conta e usuários".
- **Base de súmulas e temas:** compartilhada pela equipe (cadastros ficam com autor e data).
- **Armazenamento:** `STORE=firestore` (Cloud Run; camada gratuita do Firestore), `STORE=file` (desenvolvimento, `DATA_DIR`) ou `memory` (testes).
  Em desenvolvimento, se não houver usuários, cria-se `admin@local.test` com senha impressa no console.

## Motores de IA (Gemini, Claude, GPT)

Na caixa "Motor de IA" escolha o provedor, informe a chave e, se quiser, o nome do modelo.
A chave trafega só até o servidor, que a repassa ao provedor naquela análise: **não é gravada nem entra em log**.
Fica em `sessionStorage` (some ao fechar a aba) ou, se marcado "lembrar", em `localStorage`.
Modelos padrão: `GEMINI_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`. As três integrações usam a API REST oficial
(`server/providers/`) e o mesmo JSON Schema, derivado de `shared/schema.ts`.

Chaves do servidor (`GEMINI_API_KEY` etc.) podem ser usadas por qualquer usuário autenticado.

## Verificação de precedentes

`shared/precedentes.ts` extrai súmulas, súmulas vinculantes, temas e números de acórdãos da minuta, do checklist e do diagnóstico, e classifica:

| Situação | Significado |
|---|---|
| Confirmada na base | consta da base local e está vigente (mostra o enunciado e checa se o contexto da citação é pertinente) |
| Cancelada / superada | consta da base como cancelada |
| Inexistente (provável) | número fora da faixa existente (STF só vai até a Súmula 736) |
| Fora da base / conferir no portal | plausível, mas sem fonte offline: **exige conferência humana** |

Na aba **Precedentes** o assessor marca cada item (conferido, divergente, descartado), anota o enunciado conferido no portal,
cadastra a súmula/tema na **própria base** (exportável/importável em JSON) e reverifica. A base inicial
(`shared/precedentesBase.ts`) é pequena e curada; ela não substitui o portal oficial, cujo link aparece em cada item.
Temas repetitivos/de repercussão geral e acórdãos nunca são "confirmados" automaticamente.

## Consulta de súmulas e precedentes vinculantes

O botão **Consultar Súmulas** (cabeçalho) abre um campo de consulta exclusivo à base local, sem IA e sem enviar dados a terceiros. Aceita
número (`7`), citação (`súmula 7 stj`, `SV 10`, `tema 466 stf`) ou palavras do enunciado (`reexame de prova`), com filtros por tribunal e tipo.
Para números fora da base indica se são plausíveis ou inexistentes e leva ao portal oficial; o usuário cadastra/corrige na própria base
(exportável/importável).

## Prazos e relevância

`shared/prazos.ts` calcula o prazo de 15 dias úteis (CPC 219/224/1.003 §5º) com feriados nacionais, de Curitiba, Carnaval, Semana Santa,
Corpus Christi, recesso de 20/12 a 20/01, prazo em dobro e interrupção por embargos, além do marco de 03/09/2026 da relevância. Entradas:

- **Data da intimação/publicação** do acórdão (e dos embargos, se houver): informada pelo usuário e obrigatória; prevalece sobre a extraída pela IA.
- **Feriados e suspensões**: o sistema pergunta se há feriado local, suspensão ou indisponibilidade; cada data informada deixa de contar como dia útil.
- **Data de interposição**: lida do carimbo de protocolo do PDF do recurso (detecção por regex no texto extraído, com página e trecho; a IA também a extrai e o sistema alerta se divergirem).
  Pode ser corrigida no painel de prazos, que recalcula na hora. Ordem de precedência: usuário, carimbo do PDF, IA.

## Conversão de PDF em texto (menos tokens)

Ao anexar, cada PDF é convertido no navegador (pdf.js) para Markdown enxuto com marcadores `[p. N]`: sem cabeçalhos/rodapés repetidos, linhas
reunidas e hifenização desfeita. O card mostra páginas, tokens estimados e a economia sobre o PDF (estimativa grosseira; o consumo real varia por provedor).
O texto pode ser revisado/editado antes do envio (corrigir extração, tarjar dados pessoais). Só o texto vai ao servidor; no modo texto o limite de 22 MB
de PDFs não se aplica. PDFs escaneados (sem camada de texto) são enviados como PDF original, com aviso; o usuário também pode forçar o envio do PDF por arquivo.
No modo texto a varredura de prompt injection alcança o conteúdo dos autos.

## Hospedagem no Google Cloud Run (camada gratuita)

Pré-requisitos: projeto GCP com faturamento ativo (exigido mesmo para a camada gratuita) e `gcloud` autenticado.

```bash
PROJECT_ID=meu-projeto ADMIN_EMAIL=voce@exemplo.gov.br ./scripts/deploy-cloudrun.sh
```

O script habilita as APIs, cria o banco Firestore (modo nativo) e desliga a indexação dos campos de dados extraídos, gera `SESSION_SECRET` e a senha do
primeiro administrador no Secret Manager, concede à conta de serviço o papel `roles/datastore.user` e publica com `gcloud run deploy --source .`
(Dockerfile incluso): região `us-central1`, `--min-instances 0` (escala a zero), `--max-instances 2`, 1 vCPU/512 MiB. Ao fim imprime a URL e, no
primeiro deploy, o e-mail e a senha inicial do administrador (troque-a na tela).
Pontos de atenção:

- Confira os limites vigentes da camada gratuita do Cloud Run na página de preços do Google; Cloud Build, Artifact Registry e Secret Manager têm cotas gratuitas próprias e pequenas (apague imagens antigas).
- O Cloud Run aceita requisições de até **32 MiB**: o sistema limita a 22 MB de PDFs por análise.
- O custo das chamadas de IA é do dono da chave informada, não do Cloud Run.
- Escalando a zero, o limitador de requisições é por instância; para controle global use Cloud Armor/API Gateway. O Firestore tem camada gratuita própria (1 GiB, 50 mil leituras e 20 mil gravações por dia); confira a página de preços.
- O adaptador do Firestore (`server/store/firestore.ts`) foi escrito para a API oficial, mas não foi exercitado contra um projeto real neste repositório (os testes usam o armazenamento em memória/arquivo): valide no primeiro deploy.
- Para restringir o acesso à rede do órgão, troque `--allow-unauthenticated` por IAP/VPC ou autenticação do Cloud Run.

## Segurança e privacidade

- Login com sessão, CSRF por cabeçalho, rate limit, `helmet` + CSP, validação de entrada (zod), PDF com assinatura `%PDF` e limites de tamanho.
- Log estruturado sem conteúdo dos autos, chaves ou tokens (apenas provedor, modelo, nº de arquivos, duração, status).
- O usuário declara, antes de enviar, estar autorizado e que os autos não estão em segredo de justiça. **Os autos vão ao provedor de IA escolhido**:
  valide a política do órgão (LGPD, Res. CNJ 615/2025) antes de usar em produção.
- Prompt injection: mitigação parcial (delimitadores, varredura das notas e do texto extraído, instruções de sistema, validação do schema de saída).
  PDFs enviados como arquivo original não são varridos; por isso a revisão humana é obrigatória.
- Os registros ficam no banco da nuvem (só dados extraídos/cadastrados, nunca os arquivos). No navegador ficam apenas preferências e, se você pedir, chaves de API.

## Estrutura

```
shared/   schema (zod), prazos, precedentes, regras (marco da relevância)   ← usado por servidor e interface
server/   Express, prompt, provedores (gemini|claude|gpt), caso de exemplo
src/      interface React
tests/    vitest (prazos, precedentes, servidor, provedores simulados)
docs/     estudo-admissibilidade-1vp.txt (material de referência)
```
