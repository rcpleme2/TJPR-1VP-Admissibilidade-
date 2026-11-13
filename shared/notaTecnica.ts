import type { AdmissibilityAnalysisResult, ChecklistItem, ChecklistStatus } from './schema';
import { especie, obterPreparo, type Especie } from './preparo';
import { avisosSobrestamento, obterSobrestamento, rotuloTema } from './sobrestamento';

/**
 * Conteúdo da nota técnica exportada. Preliminar e pressupostos extrínsecos saem dos dados
 * verificados (prazos calculados, preparo e sobrestamento conferidos pelo assessor); o exame de
 * cada recurso e a proposta vêm do texto curto da IA, com alternativa montada do checklist.
 */

export type Tom = 'ok' | 'atencao' | 'obice' | 'neutro';
export interface Celula {
  texto: string;
  tom: Tom;
}
export interface LinhaQuadro {
  grupo: string;
  requisito: string;
  ressalva?: string;
  resp: Celula | null;
  re: Celula | null;
}
export interface SecaoNota {
  titulo: string;
  texto: string;
}
export interface NotaTecnica {
  secoes: SecaoNota[];
  pendencias: string[];
  temREsp: boolean;
  temRE: boolean;
  quadro: LinhaQuadro[];
}

/** "Tema 466/STJ" ou, no plural, "Temas 466/STJ e 660/STF". */
const temas = (ts: Array<{ numero: string; tribunal: 'STJ' | 'STF' }>) =>
  ts.length === 1 ? rotuloTema(ts[0]!) : `Temas ${lista(ts.map((t) => rotuloTema(t).replace(/^Tema /, '')))}`;

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);
const nomeRecurso: Record<'REsp' | 'RE', string> = { REsp: 'recurso especial', RE: 'recurso extraordinário' };

const primeiraFrase = (t: string, max = 220) => {
  const f = (t || '').trim().split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)[0] ?? '';
  return f.length <= max ? f : `${f.slice(0, max).replace(/\s+\S*$/, '')}…`;
};

/** A qual recurso um item do checklist se aplica (campo da IA ou, em análises antigas, pelo texto). */
export function alvoItem(item: ChecklistItem, secaoTitulo: string): 'REsp' | 'RE' | 'ambos' {
  if (item.recurso) return item.recurso;
  const t = `${item.titulo} ${secaoTitulo}`;
  const resp = /\bREsp\b|especial|\bSTJ\b|relev[âa]ncia/i.test(t);
  const re = /\bRE\b|extraordin|\bSTF\b|repercuss[ãa]o/i.test(t);
  return resp && !re ? 'REsp' : re && !resp ? 'RE' : 'ambos';
}

const STATUS: Record<ChecklistStatus, Celula> = {
  conforme: { texto: 'Conforme', tom: 'ok' },
  nao_conforme: { texto: 'Óbice', tom: 'obice' },
  atencao: { texto: 'Verificar', tom: 'atencao' },
  nao_aplicavel: { texto: 'Não se aplica', tom: 'neutro' },
};

export function montarNotaTecnica(d: AdmissibilityAnalysisResult): NotaTecnica {
  const especies = new Set(d.recursosAnalisados.map((r) => especie(r.tipo)).filter(Boolean) as Array<'REsp' | 'RE'>);
  const temREsp = especies.has('REsp') || especies.size === 0;
  const temRE = especies.has('RE');
  const sob = obterSobrestamento(d);
  const preparo = obterPreparo(d);
  const prazos = d.verificacoes?.prazos ?? [];
  const pendencias: string[] = [];
  const secoes: SecaoNota[] = [];

  // 1. Preliminar: sobrestamento
  const inseridos = sob.temas.filter((t) => t.enquadramento === 'se_insere');
  let tSob: string;
  if (sob.conclusao === 'sobrestar') {
    const comSusp = inseridos.filter((t) => t.suspensao === 'determinada');
    const decisoes = comSusp.map((t) => t.decisaoAfetacao).filter(Boolean);
    tSob = `A matéria se insere ${comSusp.length > 1 ? 'nos' : 'no'} ${temas(comSusp)}, com ordem de suspensão${decisoes.length ? ` (${decisoes.join('; ')})` : ''}. Propõe-se o sobrestamento quanto a essa matéria (CPC, art. 1.030, III).`;
  } else if (sob.conclusao === 'tema_sem_suspensao') {
    const julgados = inseridos.length > 0 && inseridos.every((t) => t.situacao === 'julgado');
    tSob = `A matéria corresponde ${inseridos.length > 1 ? 'aos' : 'ao'} ${inseridos.length ? temas(inseridos) : 'tema indicado'}, ${julgados ? 'com mérito julgado e ' : ''}sem ordem de suspensão pendente. Não há sobrestamento${julgados ? '; aplica-se a tese firmada' : ''}.`;
  } else if (sob.conclusao === 'nao_ha_tema') {
    tSob = 'A matéria não se insere em tema repetitivo, de repercussão geral ou de relevância com ordem de suspensão. Não há sobrestamento.';
  } else {
    tSob = sob.temas.length
      ? `${sob.temas.length === 1 ? 'Foi indicado o' : 'Foram indicados os'} ${temas(sob.temas)}, ainda sem verificação do enquadramento e da ordem de suspensão.`
      : 'Não foi verificado se a matéria se insere em tema com ordem de suspensão.';
    pendencias.push('Verificar o sobrestamento por tema repetitivo antes de concluir.');
  }
  // A fundamentação escrita pelo assessor, quando há conclusão, substitui o texto montado.
  if (sob.fundamentacao?.trim() && sob.conclusao !== 'nao_verificado') tSob = sob.fundamentacao.trim();
  secoes.push({ titulo: 'Preliminar: sobrestamento', texto: tSob });
  avisosSobrestamento(d).forEach((a) => pendencias.includes(a) || pendencias.push(a));

  // 2. Pressupostos extrínsecos
  const frases: string[] = [];
  const tempestivos = prazos.filter((p) => p.status === 'tempestivo');
  if (prazos.length && tempestivos.length === prazos.length) {
    const p0 = prazos[0]!;
    const mesmaData = prazos.every((p) => p.dataLimite === p0.dataLimite && p.dataInterposicao === p0.dataInterposicao);
    frases.push(
      mesmaData
        ? `${prazos.length > 1 ? 'Os recursos são tempestivos' : 'O recurso é tempestivo'}: prazo contado desde ${p0.dataBase}, com termo final em ${p0.dataLimite} e interposição em ${p0.dataInterposicao}.`
        : `${prazos.length > 1 ? 'Os recursos são tempestivos' : 'O recurso é tempestivo'}: ${prazos.map((p) => `${p.recursoTipo} interposto em ${p.dataInterposicao}, prazo final em ${p.dataLimite}`).join('; ')}.`,
    );
  } else {
    for (const p of prazos) {
      if (p.status === 'tempestivo') frases.push(`O ${p.recursoTipo} é tempestivo (interposição em ${p.dataInterposicao}, prazo final em ${p.dataLimite}).`);
      else if (p.status === 'intempestivo') frases.push(`O ${p.recursoTipo} é intempestivo: prazo final em ${p.dataLimite} e interposição em ${p.dataInterposicao}.`);
      else if (p.status === 'tempestivo_se_prazo_dobro') {
        frases.push(`O ${p.recursoTipo} só é tempestivo se houver prazo em dobro (prazo final em dobro: ${p.dataLimiteDobro}).`);
        pendencias.push(`Confirmar se o recorrente do ${p.recursoTipo} tem prazo em dobro.`);
      } else {
        frases.push(`A tempestividade do ${p.recursoTipo} não pôde ser calculada.`);
        pendencias.push(`Tempestividade do ${p.recursoTipo}: ${p.observacao}`);
      }
    }
  }
  for (const p of preparo) {
    const r = p.recurso;
    if (p.situacao === 'recolhido') frases.push(`O preparo do ${r} foi comprovado${p.valorRecolhido ? ` (${p.valorRecolhido})` : ''}.`);
    else if (p.situacao === 'gratuidade') frases.push(`O recorrente do ${r} é beneficiário da justiça gratuita.`);
    else if (p.situacao === 'isencao') frases.push(`O ${r} é isento de preparo.`);
    else if (p.situacao === 'insuficiente') frases.push(`O preparo do ${r} foi recolhido a menor; cabe intimar para complementação (CPC, art. 1.007, § 2º).`);
    else if (p.situacao === 'nao_comprovado') frases.push(`O preparo do ${r} não foi comprovado; cabe intimar para recolhimento em dobro (CPC, art. 1.007, § 4º).`);
    else pendencias.push(`Conferir o preparo do ${r}.`);
  }
  (d.verificacoes?.avisos ?? []).forEach((a) => pendencias.push(a));
  secoes.push({ titulo: 'Pressupostos extrínsecos', texto: frases.join(' ') || 'Tempestividade e preparo não verificados.' });

  // 3 e 4. Exame de cada recurso
  const itens = d.checklistSecoes.flatMap((s) => s.itens.map((i) => ({ i, s: s.secaoTitulo })));
  const doRecurso = (e: 'REsp' | 'RE') => itens.filter(({ i, s }) => alvoItem(i, s) === e && i.status === 'nao_conforme');
  const exame = (e: 'REsp' | 'RE', daIa?: string) => {
    if (daIa?.trim()) return daIa.trim();
    const obices = doRecurso(e);
    return obices.length
      ? obices.map(({ i }) => `${i.titulo}: ${primeiraFrase(i.analiseTecnica)}`).join(' ')
      : `Os requisitos específicos do ${nomeRecurso[e]} foram atendidos.`;
  };
  if (temREsp) secoes.push({ titulo: 'Recurso especial', texto: exame('REsp', d.notaTecnica?.recursoEspecial) });
  if (temRE) secoes.push({ titulo: 'Recurso extraordinário', texto: exame('RE', d.notaTecnica?.recursoExtraordinario) });

  // 5. Proposta
  secoes.push({
    titulo: 'Proposta',
    texto: d.notaTecnica?.proposta?.trim() || `${d.diagnosticoGeral.probabilidadeAdmissao} (${d.diagnosticoGeral.incisoArt1030Principal}).`,
  });

  itens.filter(({ i }) => i.status === 'atencao').forEach(({ i }) => pendencias.push(`Verificar ${i.id}: ${i.titulo}.`));
  const precPendentes = (d.precedentes ?? []).filter((c) => c.conferencia.situacao === 'pendente').length;
  if (precPendentes) pendencias.push(`${precPendentes === 1 ? '1 precedente citado aguarda' : `${precPendentes} precedentes citados aguardam`} conferência no portal oficial.`);

  // Quadro de requisitos por recurso
  const quadro: LinhaQuadro[] = [];
  const conclusaoCurta: Record<string, Celula> = {
    sobrestar: { texto: 'Sobrestar', tom: 'atencao' },
    tema_sem_suspensao: { texto: 'Sem suspensão', tom: 'ok' },
    nao_ha_tema: { texto: 'Não há tema', tom: 'ok' },
    nao_verificado: { texto: 'Não verificado', tom: 'atencao' },
  };
  const ambos = (c: Celula) => ({ resp: temREsp ? c : null, re: temRE ? c : null });
  quadro.push({ grupo: 'Preliminar', requisito: 'Sobrestamento por tema com suspensão', ...ambos(conclusaoCurta[sob.conclusao]!) });

  const porEspecie = <T,>(xs: T[], tipo: (x: T) => string, e: Especie) => xs.find((x) => especie(tipo(x)) === e);
  const celPrazo = (e: 'REsp' | 'RE'): Celula | null => {
    const p = porEspecie(prazos, (x) => x.recursoTipo, e);
    if (!p) return null;
    return {
      tempestivo: { texto: 'Tempestivo', tom: 'ok' as Tom },
      intempestivo: { texto: 'Intempestivo', tom: 'obice' as Tom },
      tempestivo_se_prazo_dobro: { texto: 'Só em dobro', tom: 'atencao' as Tom },
      indeterminado: { texto: 'Indeterminado', tom: 'atencao' as Tom },
    }[p.status];
  };
  const celPreparo = (e: 'REsp' | 'RE'): Celula | null => {
    const p = porEspecie(preparo, (x) => x.recurso, e);
    if (!p) return null;
    return {
      recolhido: { texto: 'Recolhido', tom: 'ok' as Tom },
      gratuidade: { texto: 'Justiça gratuita', tom: 'ok' as Tom },
      isencao: { texto: 'Isento', tom: 'ok' as Tom },
      insuficiente: { texto: 'A menor', tom: 'atencao' as Tom },
      nao_comprovado: { texto: 'Não comprovado', tom: 'obice' as Tom },
      a_verificar: { texto: 'A verificar', tom: 'atencao' as Tom },
    }[p.situacao];
  };
  if (prazos.length) quadro.push({ grupo: 'Extrínsecos', requisito: 'Tempestividade', resp: temREsp ? celPrazo('REsp') : null, re: temRE ? celPrazo('RE') : null });
  if (preparo.length) quadro.push({ grupo: prazos.length ? '' : 'Extrínsecos', requisito: 'Preparo', resp: temREsp ? celPreparo('REsp') : null, re: temRE ? celPreparo('RE') : null });

  for (const sec of d.checklistSecoes) {
    // tempestividade e preparo já entram pelos cálculos e pela conferência acima
    if (/tempestiv|preparo/i.test(sec.secaoTitulo)) continue;
    const grupo = sec.secaoTitulo.replace(new RegExp(`^${sec.secaoCodigo}[.)\\s–-]+`), '');
    sec.itens.forEach((it, k) => {
      const alvo = alvoItem(it, sec.secaoTitulo);
      const c = STATUS[it.status];
      const vazio: Celula = { texto: '—', tom: 'neutro' };
      quadro.push({
        grupo: k === 0 ? grupo : '',
        requisito: `${it.id}  ${it.titulo}`,
        ressalva: it.observacaoAssessor?.trim() || undefined,
        resp: temREsp ? (alvo === 'RE' ? vazio : c) : null,
        re: temRE ? (alvo === 'REsp' ? vazio : c) : null,
      });
    });
  }

  return { secoes, pendencias: [...new Set(pendencias)], temREsp, temRE, quadro };
}
