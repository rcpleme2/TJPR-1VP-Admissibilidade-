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
# Projetos novos não dão à conta de serviço padrão as permissões de build; sem elas o "# --- Imagem ------------------------------------------------------------------------------------------
# Padrão: Cloud Build (--source). Com LOCAL_BUILD=1 e Docker disponível (Cloud Shell), constrói a imagem localmente.
FONTE=(--source .)
if [ "${LOCAL_BUILD:-0}" = "1" ] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/admissibilidade"
  IMAGEM="${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"
  gcloud artifacts repositories describe admissibilidade --location="$REGION" >/dev/null 2>&1 \
    || gcloud artifacts repositories create admissibilidade --repository-format=docker --location="$REGION" --description="Imagens do sistema de admissibilidade"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
  docker build -t "$IMAGEM" .
  docker push "$IMAGEM"
  FONTE=(--image "$IMAGEM")
fi

gcloud run deploy "$SERVICE" \
  "${FONTE[@]}" \
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
