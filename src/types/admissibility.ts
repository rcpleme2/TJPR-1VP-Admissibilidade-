export type ChecklistStatus = 'conforme' | 'nao_conforme' | 'atencao' | 'nao_aplicavel';

export interface ProcessoInfo {
  numero: string;
  classe: string;
  materia: string;
  origemOrgao: string;
  relatorOrigem?: string;
  recorrentes: string[];
  recorridos: string[];
  advogados?: string[];
  dataPublicacaoAcordao: string;
  houveEmbargosDeclaracao?: boolean;
  dataPublicacaoEmbargos?: string;
  marcoTemporalRelevancia2026: string;
  exigeTopicoRelevancia: boolean;
  valorCausa?: string;
}

export interface RecursoAnalisado {
  id: string;
  tipo: string;
  recorrente: string;
  alineasConstitucionais?: string[];
  dispositivosInvocados?: string[];
  tesesPrincipais?: string[];
}

export interface ChecklistItem {
  id: string;
  titulo: string;
  status: ChecklistStatus;
  novidade2026?: boolean;
  analiseTecnica: string;
  fundamentoLegal?: string;
  trechoRelevante?: string;
  observacaoAssessor?: string; // allow assessor to annotate
}

export interface ChecklistSecao {
  secaoCodigo: string; // A, B, C, D, E, F, G, H, I, J
  secaoTitulo: string;
  itens: ChecklistItem[];
}

export interface DiagnosticoGeral {
  probabilidadeAdmissao: string;
  incisoArt1030Principal: string;
  isDecisaoMista: boolean;
  recursoCabivelAdvertencia: string;
  principaisObicesIdentificados: string[];
  resumoParecer: string;
}

export interface CapituloFundamentacao {
  tituloCapitulo: string;
  incisoArt1030: string;
  conteudo: string;
  recursoCabivel?: string;
}

export interface MinutaDecisao1VP {
  cabecalho: string;
  relatorio: string;
  capitulosFundamentacao: CapituloFundamentacao[];
  dispositivoFinal: string;
  advertenciaRecursual: string;
}

export interface AdmissibilityAnalysisResult {
  processo: ProcessoInfo;
  recursosAnalisados: RecursoAnalisado[];
  checklistSecoes: ChecklistSecao[];
  diagnosticoGeral: DiagnosticoGeral;
  minutaDecisao1VP: MinutaDecisao1VP;
}

export interface UploadedFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  role: 'acordao' | 'acordao_embargos' | 'recurso_especial' | 'recurso_extraordinario' | 'outro';
  label: string;
  dataBase64?: string;
  textPreview?: string;
}
