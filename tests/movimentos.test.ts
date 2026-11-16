import { describe, expect, it } from 'vitest';
import { acharMovimento, extrairMovimentos, interposicoes, LIMITE_TEXTO_MOVIMENTOS, RE_CITACAO_MOV, unirMovimentos } from '../shared/movimentos';
import { extrairDataProtocolo, protocolosDosAnexos } from '../shared/protocolo';
import { montarMarkdown } from '../shared/textoPdf';
import { verificarPrazos } from '../shared/prazos';
import sample from '../server/fixtures/sample-case.json';
import type { ModelOutput } from '../shared/schema';

// carimbo do Projudi no fim de cada página (dados fictícios)
const pagina = (mov: string, data: string, desc: string, arq: string, corpo: string[]) => [
  ...corpo,
  'Documento assinado digitalmente, conforme MP nº 2.200-2/2001, Lei nº 11.419/2006, resolução do Projudi, do TJPR/OE',
  `PROJUDI - Processo: 0014298-70.2023.8.16.0001 - Ref. mov. ${mov} - Assinado digitalmente por Fulano:000`,
  `${data}: ${desc}. Arq: ${arq}`,
].join('\n');

const autos = [
  pagina('15.2', '02/03/2024', 'JUNTADA DE DECISÃO', 'Decisão', ['DECISÃO', 'Defiro a gratuidade da justiça ao autor.']),
  pagina('88.1', '30/10/2026', 'INTERPOSIÇÃO DE RECURSO', 'Petição', ['EXCELENTÍSSIMO SENHOR DESEMBARGADOR 1º VICE-PRESIDENTE', 'RECURSO ESPECIAL', 'Banco Progresso S/A, inconformado...']),
  pagina('88.1', '30/10/2026', 'INTERPOSIÇÃO DE RECURSO', 'Petição', ['continuação da petição, página dois']),
  pagina('89.1', '30/10/2026', 'INTERPOSIÇÃO DE RECURSO', 'Petição', ['RECURSO EXTRAORDINÁRIO', 'Banco Progresso S/A...']),
];

describe('movimentações', () => {
  it('agrupa as páginas por movimento, com data, descrição e conteúdo', () => {
    const m = extrairMovimentos(autos, 'integra.pdf');
    expect(m.map((x) => x.ref)).toEqual(['15.2', '88.1', '89.1']);
    const resp = m[1]!;
    expect(resp).toMatchObject({ data: '30/10/2026', descricao: 'INTERPOSIÇÃO DE RECURSO', arquivo: 'Petição', paginas: [2, 3], origem: 'integra.pdf' });
    expect(resp.texto).toContain('RECURSO ESPECIAL');
    expect(resp.texto).toContain('página dois');
    expect(resp.texto).not.toMatch(/Assinado digitalmente|Arq:/);
  });

  it('lê listagens de movimentação', () => {
    const m = extrairMovimentos(['Movimentações', '90  05/11/2026 14:02:11  CONCLUSOS PARA DECISÃO   Fulano', 'Texto comum 12 de março'], 'capa.pdf');
    expect(m).toEqual([expect.objectContaining({ ref: '90', data: '05/11/2026', descricao: 'CONCLUSOS PARA DECISÃO' })]);
  });

  it('acha o movimento citado e reconhece citações no texto', () => {
    const m = extrairMovimentos(autos, 'x');
    expect(acharMovimento(m, '88')?.ref).toBe('88.1');
    expect(acharMovimento(m, '15.2')?.descricao).toBe('JUNTADA DE DECISÃO');
    const refs = [...'gratuidade (mov. 15.2), seq. 88.1 e evento 89'.matchAll(RE_CITACAO_MOV)].map((x) => x[2]);
    expect(refs).toEqual(['15.2', '88.1', '89']);
  });

  it('une vários PDFs sem repetir e respeita o teto de texto', () => {
    const grande = { ref: '1.1', origem: 'a', paginas: [1], texto: 'x'.repeat(LIMITE_TEXTO_MOVIMENTOS + 10) };
    const u = unirMovimentos([[grande], [{ ...grande, ref: '2.1', texto: 'y' }], extrairMovimentos(autos, 'b')]);
    expect(u.map((x) => x.ref)).toEqual(['1.1', '2.1', '15.2', '88.1', '89.1']);
    expect(u.reduce((t, x) => t + x.texto.length, 0)).toBeLessThanOrEqual(LIMITE_TEXTO_MOVIMENTOS + 2);
  });

  it('marca o início de cada movimento no texto enviado à IA', () => {
    const md = montarMarkdown(autos.map((p) => p.split('\n')));
    expect(md.texto).toContain('[p. 2] [mov. 88.1]');
    expect(md.texto).not.toContain('[p. 3] [mov.');
    expect(md.texto).toContain('[p. 4] [mov. 89.1]');
  });
});

describe('protocolo pela interposição de recurso', () => {
  it('identifica o tipo de cada interposição pelo conteúdo da petição', () => {
    const i = interposicoes(extrairMovimentos(autos, 'x'));
    expect(i.map((x) => [x.mov.ref, x.papel])).toEqual([
      ['88.1', 'recurso_especial'],
      ['89.1', 'recurso_extraordinario'],
    ]);
  });

  it('prefere a interposição ao carimbo de juntada', () => {
    const peticao = [0, 1].map(() => pagina('1.1', '28/10/2026', 'JUNTADA DE PETIÇÃO DE RECURSO ESPECIAL', 'Petição', ['corpo']));
    expect(extrairDataProtocolo(peticao)!.data).toBe('28/10/2026');
    const p = protocolosDosAnexos([
      { name: 'resp.pdf', role: 'recurso_especial', protocolo: extrairDataProtocolo(peticao)!, movimentos: extrairMovimentos(peticao, 'resp.pdf') },
      { name: 'integra.pdf', role: 'outro', movimentos: extrairMovimentos(autos, 'integra.pdf') },
    ]);
    expect(p).toEqual([expect.objectContaining({ papel: 'recurso_especial', data: '30/10/2026', referencia: 'mov. 88.1', movimento: 'INTERPOSIÇÃO DE RECURSO' })]);
  });

  it('usa interposição genérica quando só há um tipo de recurso', () => {
    const generica = [pagina('70.1', '12/08/2026', 'INTERPOSIÇÃO DE RECURSO', 'Petição', ['Razões recursais'])];
    const p = protocolosDosAnexos([
      { name: 're.pdf', role: 'recurso_extraordinario' },
      { name: 'integra.pdf', role: 'outro', movimentos: extrairMovimentos(generica, 'integra.pdf') },
    ]);
    expect(p[0]).toMatchObject({ papel: 'recurso_extraordinario', data: '12/08/2026' });
  });

  it('o cálculo do prazo cita a movimentação como fonte', () => {
    const p = protocolosDosAnexos([{ name: 'integra.pdf', role: 'recurso_especial', movimentos: extrairMovimentos(autos, 'integra.pdf') }]);
    const v = verificarPrazos(sample as ModelOutput, { protocolos: p, feriadosRespondido: true });
    expect(v.prazos[0]!.fonteInterposicao).toBe('movimentação "INTERPOSIÇÃO DE RECURSO" (mov. 88.1)');
  });
});

describe('intimação em duplicidade', () => {
  const sem = { ...(sample as ModelOutput), processo: { ...(sample as ModelOutput).processo, houveEmbargosDeclaracao: false, dataPublicacaoEmbargos: undefined } };
  const ent = (x: object) => ({ feriadosRespondido: true, feriados: [], interposicaoManual: { rec_resp_1: '2026-10-20' }, protocolos: [], ...x });

  it('calcula o prazo para o Diário e para a intimação eletrônica', () => {
    const v = verificarPrazos(sem, ent({ dataIntimacaoAcordao: '2026-09-15', dataIntimacaoAcordaoEletronica: '2026-09-28' }));
    const p = v.prazos[0]!;
    expect(p.porMeio?.map((m) => [m.meio, m.dataBase, m.status])).toEqual([
      ['diario', '15/09/2026', 'tempestivo_se_prazo_dobro'],
      ['eletronica', '28/09/2026', 'tempestivo'],
    ]);
    expect(p.status).toBe('indeterminado');
    expect(p.observacao).toMatch(/pelo Diário, tempestivo só com prazo em dobro; pela intimação eletrônica, tempestivo/);
    expect(v.avisos.join(' ')).toMatch(/duas intimações/);
  });

  it('mantém o status quando os dois meios dão o mesmo resultado', () => {
    const v = verificarPrazos(sem, ent({ dataIntimacaoAcordao: '2026-10-01', dataIntimacaoAcordaoEletronica: '2026-10-02' }));
    expect(v.prazos[0]!.status).toBe('tempestivo');
    expect(v.prazos[0]!.porMeio).toHaveLength(2);
  });

  it('só um meio informado: cálculo único, sem quadro por meio', () => {
    const semDiario = { ...sem, processo: { ...sem.processo, dataPublicacaoAcordao: undefined } };
    const v = verificarPrazos(semDiario, ent({ dataIntimacaoAcordaoEletronica: '2026-10-02' }));
    expect(v.prazos[0]!.porMeio).toBeUndefined();
    expect(v.prazos[0]!.fonteBase).toMatch(/intimação eletrônica/);
    expect(v.prazos[0]!.status).toBe('tempestivo');
  });

  it('havendo embargos, a intimação eletrônica do acórdão original não serve de base', () => {
    const v = verificarPrazos(sample as ModelOutput, ent({ dataIntimacaoAcordaoEletronica: '2026-09-20' }));
    expect(v.prazos[0]!.porMeio).toBeUndefined();
    expect(v.avisos.join(' ')).toMatch(/intimação eletrônica só do acórdão original/);
  });
});

describe('gravação das movimentações', () => {
  it('passam pelo esquema e cabem no limite do registro', async () => {
    const { enriquecer } = await import('../server/analyze');
    const { AdmissibilityAnalysisResultSchema } = await import('../shared/schema');
    const { MAX_BYTES_REGISTRO } = await import('../shared/registro');
    const d = enriquecer(sample as ModelOutput, { provedor: 'exemplo', modelo: 'x', geradoEm: '2026-11-16T00:00:00Z' });
    const r = AdmissibilityAnalysisResultSchema.parse(d);
    expect(r.movimentos?.map((m) => m.ref)).toContain('88.1');
    const cheio = { ...r, movimentos: unirMovimentos([Array.from({ length: 400 }, (_, i) => ({ ref: `${i + 1}.1`, origem: 'x.pdf', paginas: [i + 1], texto: 'z'.repeat(2500) }))]) };
    expect(AdmissibilityAnalysisResultSchema.safeParse(cheio).success).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(cheio)).length).toBeLessThan(MAX_BYTES_REGISTRO);
  });
});
