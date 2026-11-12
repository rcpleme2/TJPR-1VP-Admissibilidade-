import type { TipoPrecedenteSchema } from './schema';
import type { z } from 'zod';

export interface EntradaBase {
  tipo: Exclude<z.infer<typeof TipoPrecedenteSchema>, 'acordao'>;
  tribunal: 'STJ' | 'STF';
  numero: string;
  enunciado: string;
  situacao: 'vigente' | 'cancelada' | 'superada';
  /** Termos (sem acento, minúsculos) esperados no contexto em que a súmula é citada. */
  palavrasChave: string[];
  /** Origem do registro. Entradas do usuário recebem "usuario". */
  fonte: 'base_inicial' | 'usuario';
}

/**
 * BASE INICIAL – cobre as súmulas mais usadas no juízo de admissibilidade de REsp/RE.
 * Não é exaustiva e NÃO substitui a consulta ao portal oficial: o sistema trata
 * qualquer número fora desta base como "não encontrada – conferir". O usuário pode
 * complementar a base na aba "Precedentes".
 */
export const BASE_INICIAL: EntradaBase[] = [
  { tipo: 'sumula', tribunal: 'STJ', numero: '5', enunciado: 'A simples interpretação de cláusula contratual não enseja recurso especial.', situacao: 'vigente', palavrasChave: ['clausula', 'contrat'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '7', enunciado: 'A pretensão de simples reexame de prova não enseja recurso especial.', situacao: 'vigente', palavrasChave: ['reexame', 'prova', 'fatic', 'probatori'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '13', enunciado: 'A divergência entre julgados do mesmo tribunal não enseja recurso especial.', situacao: 'vigente', palavrasChave: ['diverg', 'mesmo tribunal', 'paradigma'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '83', enunciado: 'Não se conhece do recurso especial pela divergência, quando a orientação do tribunal se firmou no mesmo sentido da decisão recorrida.', situacao: 'vigente', palavrasChave: ['diverg', 'orientacao', 'jurisprudencia', 'dominante', 'alinea'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '98', enunciado: 'Embargos de declaração manifestados com notório propósito de prequestionamento não têm caráter protelatório.', situacao: 'vigente', palavrasChave: ['embargos', 'prequestion', 'protelatori'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '115', enunciado: 'Na instância especial é inexistente recurso interposto por advogado sem procuração nos autos.', situacao: 'vigente', palavrasChave: ['procura', 'mandato', 'advogado', 'representa'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '123', enunciado: 'A decisão que admite, ou não, o recurso especial deve ser fundamentada, com o exame dos seus pressupostos gerais e constitucionais.', situacao: 'vigente', palavrasChave: ['fundament', 'admissibilidade', 'pressuposto'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '126', enunciado: 'É inadmissível recurso especial, quando o acórdão recorrido assenta em fundamentos constitucional e infraconstitucional, qualquer deles suficiente, por si só, para mantê-lo, e a parte vencida não manifesta recurso extraordinário.', situacao: 'vigente', palavrasChave: ['constitucional', 'extraordinario', 'fundamento'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '182', enunciado: 'É inviável o agravo do art. 545 do CPC que deixa de atacar, especificamente, os fundamentos da decisão agravada.', situacao: 'vigente', palavrasChave: ['agravo', 'atacar', 'impugn', 'fundamento'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '203', enunciado: 'Não cabe recurso especial contra decisão proferida por órgão de segundo grau dos Juizados Especiais.', situacao: 'vigente', palavrasChave: ['juizado', 'turma recursal'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '211', enunciado: 'Inadmissível recurso especial quanto à questão que, a despeito da oposição de embargos declaratórios, não foi apreciada pelo tribunal a quo.', situacao: 'vigente', palavrasChave: ['prequestion', 'embargos', 'apreciad', 'debat'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '418', enunciado: 'É inadmissível o recurso especial interposto antes da publicação do acórdão dos embargos de declaração, sem posterior ratificação.', situacao: 'cancelada', palavrasChave: ['ratific', 'embargos', 'prematur'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '479', enunciado: 'As instituições financeiras respondem objetivamente pelos danos gerados por fortuito interno relativo a fraudes e delitos praticados por terceiros no âmbito de operações bancárias.', situacao: 'vigente', palavrasChave: ['banc', 'financeir', 'fraude', 'fortuito'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '518', enunciado: 'Para fins do artigo 105, III, a, da Constituição Federal, não é cabível recurso especial por violação de enunciado de súmula.', situacao: 'vigente', palavrasChave: ['sumula', 'enunciado', 'violacao', 'lei federal'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '568', enunciado: 'O relator, monocraticamente e no Superior Tribunal de Justiça, poderá dar provimento ou negar seguimento ao recurso quando existir entendimento dominante a respeito do tema.', situacao: 'vigente', palavrasChave: ['relator', 'monocrat', 'dominante'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STJ', numero: '579', enunciado: 'Não é necessário ratificar o recurso especial interposto na pendência de embargos de declaração, quando não houver alteração do resultado do julgamento anterior.', situacao: 'vigente', palavrasChave: ['ratific', 'embargos', 'prematur'], fonte: 'base_inicial' },

  { tipo: 'sumula', tribunal: 'STF', numero: '279', enunciado: 'Para simples reexame de prova não cabe recurso extraordinário.', situacao: 'vigente', palavrasChave: ['reexame', 'prova', 'fatic', 'probatori'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '280', enunciado: 'Por ofensa a direito local não cabe recurso extraordinário.', situacao: 'vigente', palavrasChave: ['local', 'estadual', 'municipal'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '281', enunciado: 'É inadmissível o recurso extraordinário, quando couber na justiça de origem, recurso ordinário da decisão impugnada.', situacao: 'vigente', palavrasChave: ['ordinario', 'esgot', 'origem', 'cabivel'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '282', enunciado: 'É inadmissível o recurso extraordinário, quando não ventilada, na decisão recorrida, a questão federal suscitada.', situacao: 'vigente', palavrasChave: ['prequestion', 'ventilad', 'debat', 'questao'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '283', enunciado: 'É inadmissível o recurso extraordinário, quando a decisão recorrida assenta em mais de um fundamento suficiente e o recurso não abrange todos eles.', situacao: 'vigente', palavrasChave: ['fundamento', 'autonomo', 'suficiente', 'impugn'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '284', enunciado: 'É inadmissível o recurso extraordinário, quando a deficiência na sua fundamentação não permitir a exata compreensão da controvérsia.', situacao: 'vigente', palavrasChave: ['deficien', 'fundament', 'generic', 'compreensao'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '356', enunciado: 'O ponto omisso da decisão, sobre o qual não foram opostos embargos declaratórios, não pode ser objeto de recurso extraordinário, por faltar o requisito do prequestionamento.', situacao: 'vigente', palavrasChave: ['prequestion', 'embargos', 'omiss'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '454', enunciado: 'Simples interpretação de cláusulas contratuais não dá lugar a recurso extraordinário.', situacao: 'vigente', palavrasChave: ['clausula', 'contrat'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '636', enunciado: 'Não cabe recurso extraordinário por contrariedade ao princípio constitucional da legalidade, quando a verificação dessa contrariedade pressuponha rever a interpretação dada a normas infraconstitucionais pela decisão recorrida.', situacao: 'vigente', palavrasChave: ['legalidade', 'reflex', 'infraconstitucional'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '640', enunciado: 'É cabível recurso extraordinário contra decisão proferida por juiz de primeiro grau nas causas de alçada, ou por turma recursal de juizado especial cível e criminal.', situacao: 'vigente', palavrasChave: ['juizado', 'turma recursal', 'alcada'], fonte: 'base_inicial' },
  { tipo: 'sumula', tribunal: 'STF', numero: '735', enunciado: 'Não cabe recurso extraordinário contra acórdão que defere medida liminar.', situacao: 'vigente', palavrasChave: ['liminar', 'cautelar', 'tutela'], fonte: 'base_inicial' },

  { tipo: 'sumula_vinculante', tribunal: 'STF', numero: '10', enunciado: 'Viola a cláusula de reserva de plenário (CF, artigo 97) a decisão de órgão fracionário de tribunal que, embora não declare expressamente a inconstitucionalidade de lei ou ato normativo do Poder Público, afasta sua incidência, no todo ou em parte.', situacao: 'vigente', palavrasChave: ['reserva de plenario', 'fracionario', 'inconstitucional', 'art. 97'], fonte: 'base_inicial' },
];
