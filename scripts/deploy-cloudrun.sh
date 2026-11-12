#!/usr/bin/env bash
# Publica no Cloud Run configurado para ficar dentro da camada gratuita.
# Uso: PROJECT_ID=meu-projeto ./scripts/deploy-cloudrun.sh
set -euo pipefail

: "${PROJECT_ID:?Defina PROJECT_ID}"
REGION="${REGION:-us-central1}"      # região Tier 1 elegível à camada gratuita
SERVICE="${SERVICE:-admissibilidade-1vp}"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Token de acesso (gera um, se ainda não existir) guardado no Secret Manager.
if ! gcloud secrets describe app-access-token >/dev/null 2>&1; then
  openssl rand -base64 32 | tr -d '\n' | gcloud secrets create app-access-token --data-file=-
  echo ">> Token criado. Para ver: gcloud secrets versions access latest --secret=app-access-token"
fi
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding app-access-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor >/dev/null

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 --memory 512Mi \
  --concurrency 10 \
  --timeout 300 \
  --set-secrets APP_ACCESS_TOKEN=app-access-token:latest \
  --set-env-vars NODE_ENV=production

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
