import { describe, expect, it } from 'vitest';
import { resultadoAdmissibilidade } from '../shared/resultado';

const diag = (probabilidadeAdmissao: string, incisoArt1030Principal = '') => ({ probabilidadeAdmissao, incisoArt1030Principal, resumoParecer: '' });
const f = (conclusao: 'acolhido' | 'rejeitado') => ({ recurso: 'REsp' as const, permissivo: 'a', alegacao: '', conclusao, fundamentacao: '' });

describe('resultado do exame', () => {
  it('usa o resultado da IA ou o deduz dos fundamentos', () => {
    expect(resultadoAdmissibilidade({ resultadoAdmissibilidade: 'admitir_total', diagnosticoGeral: diag('x') })).toBe('admitir_total');
    expect(resultadoAdmissibilidade({ fundamentosRecurso: [f('rejeitado'), f('rejeitado')], diagnosticoGeral: diag('x') })).toBe('negar_seguimento');
    expect(resultadoAdmissibilidade({ fundamentosRecurso: [f('acolhido'), f('rejeitado')], diagnosticoGeral: diag('x') })).toBe('admitir_parcial');
    expect(resultadoAdmissibilidade({ fundamentosRecurso: [f('acolhido')], diagnosticoGeral: diag('x') })).toBe('admitir_total');
  });
  it('nas análises antigas, deduz do texto do diagnóstico', () => {
    expect(resultadoAdmissibilidade({ diagnosticoGeral: diag('Inadmissão parcial com negativa de seguimento') })).toBe('negar_seguimento');
    expect(resultadoAdmissibilidade({ diagnosticoGeral: diag('Admissão do recurso especial', 'Art. 1.030, V') })).toBe('admitir_total');
    expect(resultadoAdmissibilidade({ diagnosticoGeral: diag('Admissão parcial: inadmite-se o RE') })).toBe('admitir_parcial');
  });
});
