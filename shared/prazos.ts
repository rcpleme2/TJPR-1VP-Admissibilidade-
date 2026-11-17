import { MARCO_RELEVANCIA_BR, MARCO_RELEVANCIA_ISO, PRAZO_RECURSAL_DIAS_UTEIS } from './regras';
import type { EntradasPrazo, ModelOutput, VerificacaoPrazo, Verificacoes } from './schema';

/**
 * Cálculos de prazo feitos em código (e não pelo modelo de IA).
 * ATENÇÃO: o calendário aqui é nacional + Curitiba/PR. Suspensões locais, portarias
 * e indisponibilidade do sistema devem ser conferidas pelo assessor.
 */

const DAY = 86_400_000;

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatBR(d: Date): string {
  const [y, m, day] = iso(d).split('-');
  return `${day}/${m}/${y}`;
}

/** Extrai a primeira data dd/mm/aaaa (ou aaaa-mm-dd) de um texto. Retorna null se inexistente/inválida. */
export function parseData(texto: string | undefined | null): Date | null {
  if (!texto) return null;
  let y: number, m: number, d: number;
  const br = texto.match(/(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})/);
  const isoM = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoM && (!br || (isoM.index ?? 0) <= (br.index ?? 0))) {
    [y, m, d] = [Number(isoM[1]), Number(isoM[2]), Number(isoM[3])];
  } else if (br) {
    [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  } else {
    return null;
  }
  const dt = utc(y, m, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ano, mes, dia);
}

const cacheFeriados = new Map<number, Set<string>>();

/** Feriados e dias sem expediente forense (nacionais, PR e Curitiba). */
export function feriados(ano: number): Set<string> {
  const cached = cacheFeriados.get(ano);
  if (cached) return cached;
  const set = new Set<string>();
  const fixos: Array<[number, number]> = [
    [1, 1], // Confraternização Universal
    [21, 4], // Tiradentes
    [1, 5], // Dia do Trabalho
    [7, 9], // Independência
    [8, 9], // Nossa Senhora da Luz dos Pinhais (Curitiba)
    [12, 10], // N. Sra. Aparecida
    [2, 11], // Finados
    [15, 11], // Proclamação da República
    [20, 11], // Consciência Negra (nacional desde a Lei 14.759/2023)
    [25, 12], // Natal
  ];
  for (const [d, m] of fixos) set.add(iso(utc(ano, m, d)));
  const p = pascoa(ano);
  const rel = (n: number) => iso(new Date(p.getTime() + n * DAY));
  set.add(rel(-48)); // segunda de Carnaval
  set.add(rel(-47)); // terça de Carnaval
  set.add(rel(-3)); // quinta-feira santa
  set.add(rel(-2)); // sexta-feira santa
  set.add(rel(60)); // Corpus Christi
  cacheFeriados.set(ano, set);
  return set;
}

/** Recesso forense: 20/12 a 20/01, prazos suspensos (CPC, art. 220). */
export function emRecesso(d: Date): boolean {
  const m = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  return (m === 12 && dia >= 20) || (m === 1 && dia <= 20);
}

export function isDiaUtil(d: Date, extras: ReadonlySet<string> = new Set()): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (emRecesso(d)) return false;
  const key = iso(d);
  if (feriados(d.getUTCFullYear()).has(key)) return false;
  return !extras.has(key);
}

export function proximoDiaUtil(d: Date, extras?: ReadonlySet<string>): Date {
  let cur = new Date(d.getTime());
  while (!isDiaUtil(cur, extras)) cur = new Date(cur.getTime() + DAY);
  return cur;
}

/**
 * Contagem em dias úteis (CPC, arts. 219 e 224): exclui o dia da publicação;
 * o primeiro dia contado é o primeiro dia útil seguinte.
 */
export function somarDiasUteis(publicacao: Date, dias: number, extras?: ReadonlySet<string>): { inicio: Date; fim: Date } {
  let cur = new Date(publicacao.getTime());
  let contados = 0;
  let inicio: Date | null = null;
  while (contados < dias) {
    cur = new Date(cur.getTime() + DAY);
    if (isDiaUtil(cur, extras)) {
      contados++;
      if (!inicio) inicio = cur;
    }
  }
  return { inicio: inicio ?? cur, fim: cur };
}

const TIPO_RECURSO = {
  recurso_especial: /resp|especial/i,
  recurso_extraordinario: /\bre\b|extraordin/i,
} as const;

export function verificarPrazos(out: ModelOutput, entradas: Partial<EntradasPrazo> = {}): Verificacoes {
  const avisos: string[] = [];
  const p = out.processo;
  const feriadosUsuario = (entradas.feriados ?? []).map((f) => parseData(f.data)).filter((d): d is Date => d !== null);
  const extras = new Set(feriadosUsuario.map(iso));

  if (!entradas.feriadosRespondido) {
    avisos.push('Feriados locais e suspensões de expediente ainda não foram informados: responda à pergunta "há algum feriado ou suspensão no período?" para fechar a contagem.');
  }

  const uAc = parseData(entradas.dataIntimacaoAcordao);
  const uEmb = parseData(entradas.dataIntimacaoEmbargos);
  const dtAcordaoExtraida = parseData(p.dataPublicacaoAcordao);
  const dtEmbargosExtraida = parseData(p.dataPublicacaoEmbargos);
  if (p.dataPublicacaoAcordao && !dtAcordaoExtraida) avisos.push('Data de publicação do acórdão não reconhecida; informe a data da intimação.');
  if (p.houveEmbargosDeclaracao && !uEmb && !dtEmbargosExtraida) {
    avisos.push('Há embargos de declaração, mas a data de intimação/publicação do acórdão dos embargos não foi informada nem extraída.');
  }

  // Data de referência do prazo: sempre a informada pelo usuário; senão a extraída dos autos.
  const usaEmbargos = Boolean(p.houveEmbargosDeclaracao && (uEmb || dtEmbargosExtraida));
  const dtBase = usaEmbargos ? (uEmb ?? dtEmbargosExtraida) : (uAc ?? dtAcordaoExtraida);
  const fonteBase = usaEmbargos
    ? uEmb
      ? 'informada pelo usuário (intimação do acórdão dos embargos)'
      : 'extraída dos autos (publicação do acórdão dos embargos)'
    : uAc
      ? 'informada pelo usuário (intimação do acórdão)'
      : 'extraída dos autos (publicação do acórdão)';
  if (p.houveEmbargosDeclaracao && uAc && !uEmb && !dtEmbargosExtraida) {
    avisos.push('Foi informada só a intimação do acórdão original; havendo embargos, o prazo corre da intimação do acórdão dos embargos.');
  }
  if (dtAcordaoExtraida && uAc && dtAcordaoExtraida.getTime() !== uAc.getTime() && !p.houveEmbargosDeclaracao) {
    avisos.push(`A intimação informada (${formatBR(uAc)}) difere da publicação extraída dos autos (${formatBR(dtAcordaoExtraida)}); prevaleceu a informada.`);
  }
  const baseDescricao = usaEmbargos
    ? 'Intimação/publicação do acórdão dos embargos de declaração (interrupção do prazo – CPC, art. 1.026). Pressupõe embargos tempestivos e conhecidos.'
    : 'Intimação/publicação do acórdão recorrido (o dia da intimação é excluído; conta-se a partir do 1º dia útil seguinte).';

  const prazos: VerificacaoPrazo[] = out.recursosAnalisados.map((r) => {
    // data de interposição: usuário > protocolo detectado no PDF > IA
    const manual = parseData(entradas.interposicaoManual?.[r.id]);
    const protocolo = (entradas.protocolos ?? []).find((pr) => TIPO_RECURSO[pr.papel].test(r.tipo));
    const doProtocolo = parseData(protocolo?.data);
    const daIA = parseData(r.dataInterposicao);
    let dtInterp: Date | null = null;
    let fonteInterposicao = '';
    if (manual) {
      dtInterp = manual;
      fonteInterposicao = 'informada pelo usuário';
    } else if (doProtocolo) {
      dtInterp = doProtocolo;
      fonteInterposicao = `carimbo de protocolo no PDF (p. ${protocolo!.pagina})`;
    } else if (daIA) {
      dtInterp = daIA;
      fonteInterposicao = r.fonteDataInterposicao ? `extraída pela IA (${r.fonteDataInterposicao})` : 'extraída pela IA';
    }
    if (!manual && doProtocolo && daIA && doProtocolo.getTime() !== daIA.getTime()) {
      avisos.push(`${r.tipo}: a IA leu a interposição em ${formatBR(daIA)}, mas o carimbo de protocolo do PDF indica ${formatBR(doProtocolo)}. Prevaleceu o carimbo; confira.`);
    }

    const base: VerificacaoPrazo = {
      recursoId: r.id,
      recursoTipo: r.tipo,
      dataBase: dtBase ? formatBR(dtBase) : null,
      baseDescricao,
      fonteBase,
      fonteInterposicao,
      inicioContagem: null,
      dataLimite: null,
      dataLimiteDobro: null,
      dataInterposicao: dtInterp ? formatBR(dtInterp) : null,
      status: 'indeterminado',
      observacao: '',
    };
    if (!dtBase) return { ...base, observacao: 'Sem data de intimação/publicação válida: informe a data da intimação para calcular.' };
    const simples = somarDiasUteis(dtBase, PRAZO_RECURSAL_DIAS_UTEIS, extras);
    const dobro = somarDiasUteis(dtBase, PRAZO_RECURSAL_DIAS_UTEIS * 2, extras);
    base.inicioContagem = formatBR(simples.inicio);
    base.dataLimite = formatBR(simples.fim);
    base.dataLimiteDobro = formatBR(dobro.fim);
    if (!dtInterp) {
      return { ...base, observacao: 'Data de interposição não localizada no protocolo do PDF; informe-a manualmente.' };
    }
    const t = dtInterp.getTime();
    if (t <= simples.fim.getTime()) return { ...base, status: 'tempestivo', observacao: 'Interposto dentro de 15 dias úteis.' };
    if (t <= dobro.fim.getTime()) {
      return {
        ...base,
        status: 'tempestivo_se_prazo_dobro',
        observacao:
          'Fora do prazo simples. Só será tempestivo se a parte tiver prazo em dobro (Fazenda Pública, MP, Defensoria – CPC, arts. 180, 183 e 186) ou houver suspensão/feriado não informado.',
      };
    }
    return { ...base, status: 'intempestivo', observacao: 'Interposto após o prazo, mesmo contado em dobro. Confira feriados e suspensões antes de concluir.' };
  });

  if (feriadosUsuario.length > 0) {
    avisos.push(`Considerados ${feriadosUsuario.length} dia(s) não útil(eis) informado(s) pelo usuário: ${feriadosUsuario.map(formatBR).join(', ')}.`);
  }

  // marco da relevância: publicação do acórdão (informada pelo usuário prevalece sobre a extraída)
  const dtAcordao = uAc ?? dtAcordaoExtraida;
  const dtEmbargos = uEmb ?? dtEmbargosExtraida;
  const marco = parseData(MARCO_RELEVANCIA_ISO)!;
  let exigeCalc: boolean | null = null;
  let obsRel = '';
  if (dtAcordao) {
    exigeCalc = dtAcordao.getTime() >= marco.getTime();
    obsRel = exigeCalc
      ? `Acórdão publicado em ${formatBR(dtAcordao)}, a partir de ${MARCO_RELEVANCIA_BR}: tópico de relevância exigido no REsp.`
      : `Acórdão publicado em ${formatBR(dtAcordao)}, antes de ${MARCO_RELEVANCIA_BR}: tópico de relevância não exigido.`;
    if (dtEmbargos && dtAcordao.getTime() < marco.getTime() && dtEmbargos.getTime() >= marco.getTime()) {
      avisos.push(`Acórdão antes e embargos depois de ${MARCO_RELEVANCIA_BR}: situação limítrofe; confirme qual publicação define o marco da relevância.`);
    }
  } else {
    obsRel = 'Sem data de publicação do acórdão: marco da relevância não calculado.';
  }
  const confere = exigeCalc === null ? null : exigeCalc === out.processo.exigeTopicoRelevancia;
  if (confere === false) avisos.push('O campo "exige tópico de relevância" informado pela IA diverge do cálculo pela data. Prevalece o cálculo; confira a data.');

  return {
    prazos,
    relevancia: {
      dataPublicacaoAcordao: dtAcordao ? formatBR(dtAcordao) : null,
      marco: MARCO_RELEVANCIA_BR,
      exigeTopicoCalculado: exigeCalc,
      exigeTopicoModelo: out.processo.exigeTopicoRelevancia,
      confere,
      observacao: obsRel,
    },
    avisos,
  };
}
