import { describe, expect, it } from 'vitest';
import { enriquecer } from '../server/analyze';
import { detectarPapel } from '../src/components/DocumentUploadSection';
import { avisosPreparo, obterPreparo, preparoInicial } from '../shared/preparo';
import { resumirAlteracoes } from '../shared/registro';
import { AdmissibilityAnalysisResultSchema, AnalyzeRequestSchema, type ModelOutput } from '../shared/schema';
import sample from '../server/fixtures/sample-case.json';

const recursos = [
  { id: 'r1', tipo: 'Recurso Especial (REsp)', recorrente: 'A' },
  { id: 'r2', tipo: 'Recurso Extraordinário (RE)', recorrente: 'A' },
];

describe('preparo', () => {
  it('casa as indicações da IA com cada recurso e deixa o resto a verificar', () => {
    const p = preparoInicial({
      recursosAnalisados: recursos,
      preparoRecursos: [{ recurso: 'RE', situacao: 'gratuidade', fundamento: 'JG deferida no mov. 12' }],
    });
    expect(p.map((i) => [i.id, i.situacao])).toEqual([
      ['r1', 'a_verificar'],
      ['r2', 'gratuidade'],
    ]);
    expect(p[1].fundamento).toMatch(/mov\. 12/);
  });

  it('orienta a intimação antes da deserção', () => {
    const a = avisosPreparo([
      { id: '1', recurso: 'REsp', situacao: 'nao_comprovado', fundamento: '', conferido: true, origem: 'ia' },
      { id: '2', recurso: 'RE', situacao: 'insuficiente', fundamento: '', conferido: true, origem: 'ia' },
    ]);
    expect(a[0]).toMatch(/1\.007, § 4º/);
    expect(a[1]).toMatch(/1\.007, § 2º/);
  });

  it('é gerado na análise, vale para registros antigos e entra no histórico', () => {
    const d = enriquecer(sample as ModelOutput, { provedor: 'exemplo', modelo: 'x', geradoEm: '2026-11-13T00:00:00Z' });
    expect(d.preparo?.map((p) => p.situacao)).toEqual(['recolhido', 'a_verificar']);
    expect(obterPreparo({ ...d, preparo: undefined })).toHaveLength(2);
    expect(AdmissibilityAnalysisResultSchema.safeParse(d).success).toBe(true);
    const novo = { ...d, preparo: d.preparo!.map((p) => ({ ...p, conferido: true })) };
    expect(resumirAlteracoes(d, novo)).toContain('Preparo');
  });
});

describe('outros documentos', () => {
  it('reconhece guias pelo nome do arquivo', () => {
    expect(detectarPapel('Guia_custas_STJ.pdf', 'recurso_especial')).toBe('guia_preparo');
    expect(detectarPapel('comprovante-preparo-RE.pdf', 'recurso_especial')).toBe('guia_preparo');
    expect(detectarPapel('recurso_especial.pdf', 'outro')).toBe('recurso_especial');
  });

  it('aceita guia e outros documentos na requisição, sem declaração de consentimento', () => {
    const r = AnalyzeRequestSchema.safeParse({
      provider: 'gemini',
      files: [{ name: 'guia.pdf', role: 'guia_preparo', mimeType: 'text/plain', textPreview: 'GRU' }],
    });
    expect(r.success).toBe(true);
  });
});
