import { z } from 'zod';

/**
 * Fonte única de verdade para o formato da análise.
 * - Valida a saída de qualquer motor de IA (Gemini, Claude, GPT);
 * - Gera o JSON Schema enviado aos provedores;
 * - Gera os tipos TypeScript usados pelo front-end.
 */

export const ChecklistStatusSchema = z.enum(['conforme', 'nao_conforme', 'atencao', 'nao_aplicavel']);

export const ProcessoInfoSchema = z.object({
  numero: z.string(),
  classe: z.string().optional(),
  materia: z.string(),
  origemOrgao: z.string().optional(),
  relatorOrigem: z.string().optional(),
  recorrentes: z.array(z.string()).optional(),
  recorridos: z.array(z.string()).optional(),
  advogados: z.array(z.string()).optional(),
  dataPublicacaoAcordao: z.string().optional().describe('Formato dd/mm/aaaa'),
  houveEmbargosDeclaracao: z.boolean().optional(),
  dataPublicacaoEmbargos: z.string().optional().describe('Formato dd/mm/aaaa'),
  marcoTemporalRelevancia2026: z
    .string()
    .optional()
    .describe('Explica se a publicação foi anterior ou posterior ao marco da relevância e a consequência.'),
  exigeTopicoRelevancia: z.boolean(),
  valorCausa: z.string().optional(),
});

export const RecursoAnalisadoSchema = z.object({
  id: z.string(),
  tipo: z.string().describe('REsp, RE ou Ambos'),
  recorrente: z.string(),
  dataInterposicao: z
    .string()
    .optional()
    .describe('Data de interposição extraída do carimbo/certidão de PROTOCOLO da petição recursal, dd/mm/aaaa'),
  fonteDataInterposicao: z.string().optional().describe('Onde a data foi lida (ex.: "carimbo de protocolo, p. 3")'),
  alineasConstitucionais: z.array(z.string()).optional(),
  dispositivosInvocados: z.array(z.string()).optional(),
  tesesPrincipais: z.array(z.string()).optional(),
});

export const ChecklistItemSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  status: ChecklistStatusSchema,
  novidade2026: z.boolean().optional(),
  analiseTecnica: z.string(),
  fundamentoLegal: z.string().optional(),
  trechoRelevante: z.string().optional().describe('Transcrição literal, com indicação de página/evento'),
  observacaoAssessor: z.string().optional(),
});

export const ChecklistSecaoSchema = z.object({
  secaoCodigo: z.string().describe('A, B, C, D, E, F, G, H, I ou J'),
  secaoTitulo: z.string(),
  itens: z.array(ChecklistItemSchema),
});

export const DiagnosticoGeralSchema = z.object({
  probabilidadeAdmissao: z.string(),
  incisoArt1030Principal: z.string().describe('I ("a", "b" ou "c"), II, III, IV ou V'),
  isDecisaoMista: z.boolean(),
  recursoCabivelAdvertencia: z.string(),
  principaisObicesIdentificados: z.array(z.string()).optional(),
  resumoParecer: z.string(),
});

export const CapituloFundamentacaoSchema = z.object({
  tituloCapitulo: z.string(),
  incisoArt1030: z.string(),
  conteudo: z.string(),
  recursoCabivel: z.string().optional(),
});

export const MinutaDecisao1VPSchema = z.object({
  cabecalho: z.string(),
  relatorio: z.string(),
  capitulosFundamentacao: z.array(CapituloFundamentacaoSchema),
  dispositivoFinal: z.string(),
  advertenciaRecursual: z.string().optional(),
});

/** O que o modelo de IA deve devolver. */
export const ModelOutputSchema = z.object({
  processo: ProcessoInfoSchema,
  recursosAnalisados: z.array(RecursoAnalisadoSchema),
  checklistSecoes: z.array(ChecklistSecaoSchema),
  diagnosticoGeral: DiagnosticoGeralSchema,
  minutaDecisao1VP: MinutaDecisao1VPSchema,
});

// --- Campos calculados pelo sistema (nunca pelo modelo) -------------------

export const EntradasPrazoSchema = z.object({
  /** Data da intimação/publicação do acórdão informada pelo usuário (aaaa-mm-dd). */
  dataIntimacaoAcordao: z.string().optional(),
  /** Data da intimação/publicação do acórdão dos embargos informada pelo usuário. */
  dataIntimacaoEmbargos: z.string().optional(),
  /** O usuário respondeu à pergunta sobre feriados/suspensões? */
  feriadosRespondido: z.boolean().default(false),
  feriados: z.array(z.object({ data: z.string(), descricao: z.string().optional() })).default([]),
  /** Datas de interposição corrigidas pelo usuário, por id de recurso. */
  interposicaoManual: z.record(z.string(), z.string()).default({}),
  /** Datas de protocolo detectadas no texto dos PDFs dos recursos. */
  protocolos: z
    .array(
      z.object({
        arquivo: z.string(),
        papel: z.enum(['recurso_especial', 'recurso_extraordinario']),
        data: z.string(),
        pagina: z.number(),
        trecho: z.string(),
      }),
    )
    .default([]),
});

export const VerificacaoPrazoSchema = z.object({
  recursoId: z.string(),
  recursoTipo: z.string(),
  dataBase: z.string().nullable(),
  baseDescricao: z.string(),
  fonteBase: z.string().default(''),
  fonteInterposicao: z.string().default(''),
  inicioContagem: z.string().nullable(),
  dataLimite: z.string().nullable(),
  dataLimiteDobro: z.string().nullable(),
  dataInterposicao: z.string().nullable(),
  status: z.enum(['tempestivo', 'intempestivo', 'tempestivo_se_prazo_dobro', 'indeterminado']),
  observacao: z.string(),
});

export const VerificacaoRelevanciaSchema = z.object({
  dataPublicacaoAcordao: z.string().nullable(),
  marco: z.string(),
  exigeTopicoCalculado: z.boolean().nullable(),
  exigeTopicoModelo: z.boolean(),
  confere: z.boolean().nullable(),
  observacao: z.string(),
});

export const VerificacoesSchema = z.object({
  prazos: z.array(VerificacaoPrazoSchema),
  relevancia: VerificacaoRelevanciaSchema,
  avisos: z.array(z.string()),
});

export const TribunalSchema = z.enum(['STJ', 'STF']);
export const TipoPrecedenteSchema = z.enum(['sumula', 'sumula_vinculante', 'tema', 'acordao']);

export const CitacaoPrecedenteSchema = z.object({
  id: z.string(),
  tipo: TipoPrecedenteSchema,
  tribunal: TribunalSchema.nullable(),
  numero: z.string(),
  rotulo: z.string(),
  ocorrencias: z.array(z.object({ origem: z.string(), contexto: z.string() })),
  verificacao: z.object({
    status: z.enum([
      'confirmada',
      'nao_encontrada_na_base',
      'cancelada_ou_superada',
      'inexistente',
      'tribunal_indefinido',
      'requer_conferencia',
    ]),
    mensagem: z.string(),
    enunciadoOficial: z.string().optional(),
    coerencia: z.enum(['ok', 'verificar', 'nao_aplicavel']),
  }),
  linkOficial: z.string(),
  manual: z.boolean().optional(),
  conferencia: z.object({
    situacao: z.enum(['pendente', 'conferido', 'divergente', 'descartado']),
    observacao: z.string().optional(),
    enunciadoConferido: z.string().optional(),
  }),
});

export const MetaAnaliseSchema = z.object({
  provedor: z.enum(['gemini', 'claude', 'gpt', 'exemplo']),
  modelo: z.string(),
  geradoEm: z.string(),
});

/** Resultado completo trafegado entre servidor, UI, armazenamento local e PDF. */
export const AdmissibilityAnalysisResultSchema = ModelOutputSchema.extend({
  entradasPrazo: EntradasPrazoSchema.optional(),
  verificacoes: VerificacoesSchema.optional(),
  precedentes: z.array(CitacaoPrecedenteSchema).optional(),
  meta: MetaAnaliseSchema.optional(),
});

export type ChecklistStatus = z.infer<typeof ChecklistStatusSchema>;
export type ProcessoInfo = z.infer<typeof ProcessoInfoSchema>;
export type RecursoAnalisado = z.infer<typeof RecursoAnalisadoSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type ChecklistSecao = z.infer<typeof ChecklistSecaoSchema>;
export type DiagnosticoGeral = z.infer<typeof DiagnosticoGeralSchema>;
export type CapituloFundamentacao = z.infer<typeof CapituloFundamentacaoSchema>;
export type MinutaDecisao1VP = z.infer<typeof MinutaDecisao1VPSchema>;
export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type VerificacaoPrazo = z.infer<typeof VerificacaoPrazoSchema>;
export type EntradasPrazo = z.infer<typeof EntradasPrazoSchema>;
export type Verificacoes = z.infer<typeof VerificacoesSchema>;
export type CitacaoPrecedente = z.infer<typeof CitacaoPrecedenteSchema>;
export type AdmissibilityAnalysisResult = z.infer<typeof AdmissibilityAnalysisResultSchema>;

/** JSON Schema (sem a chave "$schema") para enviar aos provedores de IA. */
export function modelOutputJsonSchema(): Record<string, unknown> {
  const js = z.toJSONSchema(ModelOutputSchema, { io: 'output', target: 'draft-7' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

// --- Contrato da requisição de análise ------------------------------------

export const PROVEDORES = ['gemini', 'claude', 'gpt'] as const;
export type Provedor = (typeof PROVEDORES)[number];

export const FILE_ROLES = ['acordao', 'acordao_embargos', 'recurso_especial', 'recurso_extraordinario', 'outro'] as const;
export type FileRole = (typeof FILE_ROLES)[number];

export const LIMITES = {
  maxArquivos: 8,
  /** Soma dos PDFs (bytes reais). O Cloud Run recusa requisições acima de 32 MiB; base64 infla ~33%. */
  maxBytesTotal: 22 * 1024 * 1024,
  maxTextoPorArquivo: 1_500_000,
  maxTextoTotal: 3_000_000,
  maxNotas: 8_000,
} as const;

export const AnalyzeRequestSchema = z.object({
  provider: z.enum(PROVEDORES),
  model: z
    .string()
    .regex(/^[\w.\-:/]{1,80}$/, 'Nome de modelo inválido')
    .optional(),
  appealType: z.enum(['auto', 'resp', 're', 'ambos']).default('auto'),
  notes: z.string().max(LIMITES.maxNotas).optional().default(''),
  confirmaUsoAutorizado: z.literal(true, { error: 'É necessário confirmar o uso autorizado dos autos.' }),
  prazo: EntradasPrazoSchema.optional(),
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        role: z.enum(FILE_ROLES),
        mimeType: z.enum(['application/pdf', 'text/plain']).default('application/pdf'),
        paginas: z.number().int().min(0).max(5000).optional(),
        dataBase64: z.string().optional(),
        textPreview: z.string().max(LIMITES.maxTextoPorArquivo).optional(),
      }),
    )
    .min(1, 'Nenhum documento anexado para análise.')
    .max(LIMITES.maxArquivos, `No máximo ${LIMITES.maxArquivos} arquivos por análise.`),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
