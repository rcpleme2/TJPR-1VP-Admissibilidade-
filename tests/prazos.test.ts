import { describe, expect, it } from 'vitest';
import { feriados, formatBR, isDiaUtil, parseData, pascoa, somarDiasUteis, verificarPrazos } from '../shared/prazos';
import type { ModelOutput } from '../shared/schema';
import sample from '../server/fixtures/sample-case.json';

describe('datas e calendário', () => {
  it('interpreta datas BR e ISO e rejeita inválidas', () => {
    expect(formatBR(parseData('publicado em 15/09/2026')!)).toBe('15/09/2026');
    expect(formatBR(parseData('2026-10-08')!)).toBe('08/10/2026');
    expect(parseData('31/02/2026')).toBeNull();
    expect(parseData('sem data')).toBeNull();
  });

  it('calcula a Páscoa e feriados móveis', () => {
    expect(formatBR(pascoa(2026))).toBe('05/04/2026');
    const f = feriados(2026);
    expect(f.has('2026-02-16')).toBe(true); // carnaval
    expect(f.has('2026-04-03')).toBe(true); // sexta-feira santa
    expect(f.has('2026-06-04')).toBe(true); // corpus christi
  });

  it('exclui fins de semana, feriados e recesso', () => {
    expect(isDiaUtil(parseData('10/10/2026')!)).toBe(false); // sábado
    expect(isDiaUtil(parseData('12/10/2026')!)).toBe(false); // feriado
    expect(isDiaUtil(parseData('22/12/2026')!)).toBe(false); // recesso
    expect(isDiaUtil(parseData('21/01/2027')!)).toBe(true);
  });

  it('conta 15 dias úteis excluindo o dia da publicação', () => {
    const { inicio, fim } = somarDiasUteis(parseData('08/10/2026')!, 15);
    expect(formatBR(inicio)).toBe('09/10/2026');
    expect(formatBR(fim)).toBe('30/10/2026');
  });

  it('suspende a contagem no recesso forense', () => {
    const { fim } = somarDiasUteis(parseData('15/12/2026')!, 15);
    // 16, 17, 18/12 (3 dias) + 21/01 a 05/02 (12 dias); recesso de 20/12 a 20/01 não conta
    expect(formatBR(fim)).toBe('05/02/2027');
  });
});

describe('verificarPrazos', () => {
  const base = sample as unknown as ModelOutput;

  it('usa a publicação dos embargos e reconhece interposição tempestiva', () => {
    const v = verificarPrazos(base);
    expect(v.prazos[0].dataBase).toBe('08/10/2026');
    expect(v.prazos[0].dataLimite).toBe('30/10/2026');
    expect(v.prazos[0].status).toBe('tempestivo');
  });

  it('detecta intempestividade e prazo em dobro', () => {
    const mk = (d: string): ModelOutput => ({ ...base, recursosAnalisados: [{ ...base.recursosAnalisados[0], dataInterposicao: d }] });
    expect(verificarPrazos(mk('05/11/2026')).prazos[0].status).toBe('tempestivo_se_prazo_dobro');
    expect(verificarPrazos(mk('30/03/2027')).prazos[0].status).toBe('intempestivo');
  });

  it('fica indeterminado sem datas', () => {
    const v = verificarPrazos({ ...base, processo: { ...base.processo, dataPublicacaoAcordao: undefined, dataPublicacaoEmbargos: undefined, houveEmbargosDeclaracao: false } });
    expect(v.prazos[0].status).toBe('indeterminado');
  });

  it('calcula o marco da relevância e aponta divergência com a IA', () => {
    const antes = verificarPrazos({
      ...base,
      processo: { ...base.processo, dataPublicacaoAcordao: '02/09/2026', dataPublicacaoEmbargos: undefined, houveEmbargosDeclaracao: false, exigeTopicoRelevancia: true },
    });
    expect(antes.relevancia.exigeTopicoCalculado).toBe(false);
    expect(antes.relevancia.confere).toBe(false);
    expect(antes.avisos.some((a) => a.includes('diverge'))).toBe(true);
    const marco = verificarPrazos({ ...base, processo: { ...base.processo, dataPublicacaoAcordao: '03/09/2026' } });
    expect(marco.relevancia.exigeTopicoCalculado).toBe(true);
  });
});
