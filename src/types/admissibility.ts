// Tipos derivados do schema compartilhado (fonte única: shared/schema.ts).
export type {
  ChecklistStatus,
  ProcessoInfo,
  RecursoAnalisado,
  ChecklistItem,
  ChecklistSecao,
  DiagnosticoGeral,
  CapituloFundamentacao,
  MinutaDecisao1VP,
  VerificacaoPrazo,
  Verificacoes,
  CitacaoPrecedente,
  AdmissibilityAnalysisResult,
  Provedor,
  FileRole,
} from '../../shared/schema';

import type { FileRole } from '../../shared/schema';

export interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  role: FileRole;
  label: string;
  dataBase64?: string;
  textPreview?: string;
}
