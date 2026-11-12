import { describe, expect, it } from 'vitest';
import { criarCitacaoManual, extrairCitacoes, resumoPrecedentes, verificarPrecedentes, verificarResultado } from '../shared/precedentes';
import type { ModelOutput } from '../shared/schema';
import sample from '../server/fixtures/sample-case.json';

const nums = (t: string) => extrairCitacoes(t, 'x').map((c) => `${c.tipo}:${c.tribunal}:${c.numero}`);

describe('extração de citações', () => {
  it('reconhece formatos comuns de súmula', () => {
    expect(nums('incide a Súmula 7/STJ.')).toEqual(['sumula:STJ:7']);
    expect(nums('Súmula n. 211 do STJ')).toEqual(['sumula:STJ:211']);
    expect(nums('Súmulas 282/356/STF')).toEqual(['sumula:STF:282', 'sumula:STF:356']);
  });

  it('distribui tribunais em listas mistas', () => {
    expect(nums('Súmulas 5, 7 e 83 do STJ e 283 do STF')).toEqual(['sumula:STJ:5', 'sumula:STJ:7', 'sumula:STJ:83', 'sumula:STF:283']);
  });

  it('reconhece súmula vinculante, temas e processos', () => {
    expect(nums('Súmula Vinculante 10')).toEqual(['sumula_vinculante:STF:10']);
    expect(nums('Tema 466/STJ e Tema 660/STF')).toEqual(['tema:STJ:466', 'tema:STF:660']);
    expect(nums('Tema 1.234 da repercussão geral')).toContain('tema:STF:1234');
    const ac = extrairCitacoes('STJ, AgInt no AREsp 1.890.112; STF, ARE 1.576.450.', 'x');
    expect(ac.map((c) => c.tribunal)).toEqual(['STJ', 'STF']);
    expect(ac[0].numero).toBe('AgInt no AREsp 1.890.112');
  });

  it('não confunde numerais comuns', () => {
    expect(nums('o art. 1.030, I, e o inciso 7 do CPC')).toEqual([]);
  });
});

describe('verificação', () => {
  const v = (t: string) => verificarPrecedentes([{ origem: 'x', texto: t }]);

  it('confirma súmula existente e coerente', () => {
    const [c] = v('Aplica-se a Súmula 7/STJ, pois exigiria o reexame do conjunto fático-probatório.');
    expect(c.verificacao.status).toBe('confirmada');
    expect(c.verificacao.coerencia).toBe('ok');
    expect(c.verificacao.enunciadoOficial).toMatch(/reexame de prova/);
  });

  it('sinaliza uso incoerente com o enunciado', () => {
    const [c] = v('A prescrição foi reconhecida, nos termos da Súmula 7/STJ.');
    expect(c.verificacao.coerencia).toBe('verificar');
  });

  it('detecta súmula inexistente, cancelada e fora da base', () => {
    expect(v('Súmula 999/STF')[0].verificacao.status).toBe('inexistente');
    expect(v('Súmula 418/STJ')[0].verificacao.status).toBe('cancelada_ou_superada');
    expect(v('Súmula 300/STJ')[0].verificacao.status).toBe('nao_encontrada_na_base');
    expect(v('Súmula 7')[0].verificacao.status).toBe('tribunal_indefinido');
  });

  it('exige conferência de temas e acórdãos', () => {
    const r = v('Tema 466/STJ; REsp 1.234.567/PR');
    expect(r.map((c) => c.verificacao.status).sort()).toEqual(['requer_conferencia', 'requer_conferencia']);
  });

  it('usa a base do usuário e preserva conferências ao reverificar', () => {
    const base = [{ tipo: 'tema' as const, tribunal: 'STJ' as const, numero: '466', enunciado: 'Tese X', situacao: 'vigente' as const, palavrasChave: [], fonte: 'usuario' as const }];
    const [c] = verificarPrecedentes([{ origem: 'x', texto: 'Tema 466/STJ' }], { baseCustom: base });
    expect(c.verificacao.status).toBe('confirmada');
    const editada = { ...c, conferencia: { situacao: 'conferido' as const, observacao: 'ok' } };
    const [novamente] = verificarPrecedentes([{ origem: 'x', texto: 'Tema 466/STJ' }], { baseCustom: base, anteriores: [editada] });
    expect(novamente.conferencia.situacao).toBe('conferido');
  });

  it('mantém citações manuais e agrupa ocorrências', () => {
    const m = criarCitacaoManual('sumula', 'STJ', '83');
    const r = verificarPrecedentes([{ origem: 'a', texto: 'Súmula 7/STJ' }, { origem: 'b', texto: 'Súmula 7/STJ' }], { anteriores: [m] });
    expect(r.find((c) => c.numero === '7')!.ocorrencias).toHaveLength(2);
    expect(r.find((c) => c.numero === '83')!.manual).toBe(true);
  });

  it('analisa o caso de exemplo', () => {
    const r = verificarResultado(sample as unknown as ModelOutput);
    const resumo = resumoPrecedentes(r);
    expect(resumo.total).toBeGreaterThan(5);
    expect(r.some((c) => c.rotulo === 'Súmula 479/STJ' && c.verificacao.status === 'confirmada')).toBe(true);
    expect(r.some((c) => c.tipo === 'tema' && c.verificacao.status === 'requer_conferencia')).toBe(true);
  });
});

describe('regressões da extração', () => {
  it('ignora enumeradores "3)" após a citação', () => {
    expect(nums('(Súmula 479/STJ); 3) INADMITO o recurso')).toEqual(['sumula:STJ:479']);
    expect(nums('(Tema 660/STF); 2) NEGO SEGUIMENTO')).toEqual(['tema:STF:660']);
  });
  it('herda o tribunal do mesmo número citado em outro ponto', () => {
    const r = verificarPrecedentes([{ origem: 'a', texto: 'Tema 466 e Súmula 479/STJ' }, { origem: 'b', texto: 'Tema 466/STJ' }]);
    expect(r.filter((c) => c.tipo === 'tema')).toHaveLength(1);
    expect(r.find((c) => c.tipo === 'tema')!.ocorrencias).toHaveLength(2);
  });
  it('avalia a pertinência sobre todas as ocorrências', () => {
    const r = verificarPrecedentes([
      { origem: 'a', texto: 'Súmulas 5, 7 e 83 do STJ' },
      { origem: 'b', texto: 'Incide a Súmula 7/STJ porque exigiria reexame de provas.' },
    ]);
    expect(r.find((c) => c.numero === '7')!.verificacao.coerencia).toBe('ok');
  });
});
