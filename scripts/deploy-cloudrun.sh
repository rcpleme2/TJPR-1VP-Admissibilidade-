#!/usr/bin/env bash
# Publica no Cloud Run (camada gratuita) com registros compartilhados no Firestore.
# Uso: PROJECT_ID=meu-projeto ADMIN_EMAIL=voce@tjpr.jus.br ./scripts/deploy-cloudrun.sh
set -euo pipefail

: "${PROJECT_ID:?Defina PROJECT_ID}"
: "${ADMIN_EMAIL:?Defina ADMIN_EMAIL (primeiro administrador)}"
REGION="${REGION:-us-central1}"      # região Tier 1 elegível à camada gratuita
SERVICE="${SERVICE:-admissibilidade-1vp}"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com

# --- Firestore (modo nativo) ---------------------------------------------------------------------
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native
fi
# Os dados extraídos ficam em campos de texto grandes: sem índice (o Firestore limita entradas de índice).
gcloud firestore indexes fields update dadosJson --collection-group=casos --disable-indexes --database='(default)' || true
gcloud firestore indexes fields update dadosJson --collection-group=historico --disable-indexes --database='(default)' || true

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
# Projetos novos não dão à conta de serviço padrão as permissões de build; sem elas o "gcloud run deploy --source" falha com "Build failed".
for PAPEL in roles/datastore.user roles/cloudbuild.builds.builder roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA}" --role="$PAPEL" --condition=None >/dev/null
done

# --- Segredos (gerados uma única vez) ---------------------------------------------------------------
cria_segredo() { # nome, comando que imprime o valor
  if ! gcloud secrets describe "$1" >/dev/null 2>&1; then
    eval "$2" | tr -d '\n' | gcloud secrets create "$1" --data-file=-
    NOVO_SEGREDO="$1"
    echo ">> Segredo $1 criado."
  fi
  gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor >/dev/null
}
cria_segredo session-secret "openssl rand -base64 48"
NOVO_SEGREDO=""
cria_segredo admin-password "openssl rand -base64 18"
SENHA_NOVA="$NOVO_SEGREDO"

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 --memory 512Mi \
  --concurrency 10 \
  --timeout 300 \
  --set-secrets SESSION_SECRET=session-secret:latest,ADMIN_PASSWORD=admin-password:latest \
  --set-env-vars NODE_ENV=production,STORE=firestore,ADMIN_EMAIL="$ADMIN_EMAIL"

echo
echo "URL: $(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
if [ -n "$SENHA_NOVA" ]; then
  echo "Primeiro acesso: $ADMIN_EMAIL"
  echo "Senha inicial:   $(gcloud secrets versions access latest --secret=admin-password)  (troque em 'Conta e usuários')"
fi
