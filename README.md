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

## Motores de IA (Gemini, Claude, GPT)

Na caixa "Motor de IA" escolha o provedor, informe a chave e, se quiser, o nome do modelo.
A chave trafega só até o servidor, que a repassa ao provedor naquela análise: **não é gravada nem entra em log**.
Fica em `sessionStorage` (some ao fechar a aba) ou, se marcado "lembrar", em `localStorage`.
Modelos padrão: `GEMINI_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`. As três integrações usam a API REST oficial
(`server/providers/`) e o mesmo JSON Schema, derivado de `shared/schema.ts`.

Chaves do servidor (`GEMINI_API_KEY` etc.) só funcionam se `APP_ACCESS_TOKEN` estiver definido.

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

## Prazos e relevância

`shared/prazos.ts` calcula, a partir das datas extraídas, o prazo de 15 dias úteis (CPC 219/224/1.003 §5º), com feriados nacionais,
Curitiba, recesso de 20/12 a 20/01, prazo em dobro e interrupção por embargos, além do marco de 03/09/2026 da relevância.
Suspensões locais específicas não são conhecidas: confira.

## Hospedagem no Google Cloud Run (camada gratuita)

Pré-requisitos: projeto GCP com faturamento ativo (exigido mesmo para a camada gratuita) e `gcloud` autenticado.

```bash
PROJECT_ID=meu-projeto ./scripts/deploy-cloudrun.sh
```

O script usa `gcloud run deploy --source .` (Dockerfile incluso) com: região `us-central1`, `--min-instances 0` (escala a zero, sem custo parado),
`--max-instances 2`, 1 vCPU/512 MiB e `APP_ACCESS_TOKEN` no Secret Manager. Ao fim, imprime a URL; use o token para entrar.
Pontos de atenção:

- Confira os limites vigentes da camada gratuita do Cloud Run na página de preços do Google; Cloud Build, Artifact Registry e Secret Manager têm cotas gratuitas próprias e pequenas (apague imagens antigas).
- O Cloud Run aceita requisições de até **32 MiB**: o sistema limita a 22 MB de PDFs por análise.
- O custo das chamadas de IA é do dono da chave informada, não do Cloud Run.
- Escalando a zero, o limitador de requisições é por instância; para controle global use Cloud Armor/API Gateway.
- Para restringir o acesso à rede do órgão, troque `--allow-unauthenticated` por IAP/VPC ou autenticação do Cloud Run.

## Segurança e privacidade

- Token de acesso (`APP_ACCESS_TOKEN`), rate limit, `helmet` + CSP, validação de entrada (zod), PDF com assinatura `%PDF` e limites de tamanho.
- Log estruturado sem conteúdo dos autos, chaves ou tokens (apenas provedor, modelo, nº de arquivos, duração, status).
- O usuário declara, antes de enviar, estar autorizado e que os autos não estão em segredo de justiça. **Os autos vão ao provedor de IA escolhido**:
  valide a política do órgão (LGPD, Res. CNJ 615/2025) antes de usar em produção.
- Prompt injection: mitigação parcial (delimitadores, sanitização das notas, instruções de sistema, validação do schema de saída).
  O texto dentro dos PDFs não é varrido; por isso a revisão humana é obrigatória.
- Dados da análise ficam apenas no navegador (histórico dos últimos 10 casos, com opção de desligar e de apagar tudo).

## Estrutura

```
shared/   schema (zod), prazos, precedentes, regras (marco da relevância)   ← usado por servidor e interface
server/   Express, prompt, provedores (gemini|claude|gpt), caso de exemplo
src/      interface React
tests/    vitest (prazos, precedentes, servidor, provedores simulados)
docs/     estudo-admissibilidade-1vp.txt (material de referência)
```
