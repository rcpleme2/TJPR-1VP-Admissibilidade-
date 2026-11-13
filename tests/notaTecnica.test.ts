import { describe, expect, it } from 'vitest';
import { enriquecer } from '../server/analyze';
import { alvoItem, montarNotaTecnica } from '../shared/notaTecnica';
import type { AdmissibilityAnalysisResult, ModelOutput } from '../shared/schema';
import { generateAdmissibilityPDF } from '../src/utils/pdfGenerator';
import sample from '../server/fixtures/sample-case.json';

const base = (): AdmissibilityAnalysisResult => enriquecer(structuredClone(sample) as ModelOutput, { provedor: 'exemplo', modelo: 'x', geradoEm: '2026-11-13T00:00:00Z' });

describe('nota técnica', () => {
  it('segue a ordem do exame e usa o texto curto da IA', () => {
    const n = montarNotaTecnica(base());
    expect(n.secoes.map((s) => s.titulo)).toEqual(['Preliminar: sobrestamento', 'Pressupostos extrínsecos', 'Recurso especial', 'Recurso extraordinário', 'Proposta']);
    expect(n.secoes[1].texto).toMatch(/tempestivos/);
    expect(n.secoes[1].texto).toMatch(/R\$ 270,12/);
    expect(n.secoes[2].texto).toMatch(/Tema 466\/STJ/);
    expect(n.pendencias.join(' ')).toMatch(/sobrestamento/);
    expect(n.pendencias.join(' ')).toMatch(/preparo do Recurso Extraordinário/);
  });

  it('descreve o sobrestamento com a concordância certa e respeita a fundamentação do assessor', () => {
    const d = base();
    d.sobrestamento!.temas.forEach((t) => (t.enquadramento = 'se_insere'));
    d.sobrestamento!.conclusao = 'tema_sem_suspensao';
    expect(montarNotaTecnica(d).secoes[0].texto).toMatch(/aos Temas 466\/STJ e 660\/STF, com mérito julgado/);
    d.sobrestamento!.fundamentacao = 'Texto do assessor.';
    expect(montarNotaTecnica(d).secoes[0].texto).toBe('Texto do assessor.');
  });

  it('monta a proposta e o exame pelo checklist em análises sem o texto curto', () => {
    const d = base();
    delete d.notaTecnica;
    const n = montarNotaTecnica(d);
    expect(n.secoes.at(-1)!.texto).toContain(d.diagnosticoGeral.incisoArt1030Principal);
    expect(n.secoes[2].texto).toMatch(/Súmulas 7 e 5\/STJ|reexame/);
  });

  it('separa os requisitos por recurso no quadro', () => {
    const n = montarNotaTecnica(base());
    const h3 = n.quadro.find((l) => l.requisito.startsWith('H3'))!;
    expect(h3.resp?.texto).toBe('Óbice');
    expect(h3.re?.texto).toBe('—');
    expect(n.quadro.find((l) => l.requisito === 'Preparo')!.re?.texto).toBe('A verificar');
    expect(n.quadro.some((l) => /^D\d|^E\d/.test(l.requisito))).toBe(false);
  });

  it('identifica o recurso de itens antigos pelo texto', () => {
    const item = { id: 'x', titulo: 'Preliminar formal de Repercussão Geral', status: 'conforme' as const, analiseTecnica: '' };
    expect(alvoItem(item, 'Requisitos do Recurso Extraordinário (STF)')).toBe('RE');
    expect(alvoItem({ ...item, titulo: 'Temas repetitivos (STJ) ou repercussão geral (STF)' }, 'Precedentes')).toBe('ambos');
  });

  it('gera o PDF com nota, quadro e minuta', () => {
    const doc = generateAdmissibilityPDF(base(), { includeMinuta: true, includeQuadro: true, assessorName: 'Ana' });
    const sem = generateAdmissibilityPDF(base(), { includeMinuta: false, includeQuadro: false });
    expect(doc.getNumberOfPages()).toBeGreaterThan(sem.getNumberOfPages());
    expect(sem.getNumberOfPages()).toBeLessThanOrEqual(2);
  });
});
