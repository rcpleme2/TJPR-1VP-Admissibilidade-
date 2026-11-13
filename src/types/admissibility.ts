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
  EntradasPrazo,
} from '../../shared/schema';

import type { FileRole } from '../../shared/schema';
import type { ProtocoloDetectado } from '../../shared/protocolo';

export interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  role: FileRole;
  label: string;
  /** Arquivo original (lido só no momento do envio, se o modo for PDF). */
  arquivo?: File;
  /** "texto": envia o texto extraído em Markdown (menos tokens). "pdf": envia o PDF original. */
  modo: 'texto' | 'pdf';
  extraindo?: boolean;
  paginas?: number;
  /** Texto extraído (editável pelo usuário, p. ex. para tarjar dados pessoais). */
  textPreview?: string;
  caracteres?: number;
  escaneado?: boolean;
  linhasRemovidas?: number;
  avisoExtracao?: string;
  protocolo?: ProtocoloDetectado;
}
