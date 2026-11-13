import { describe, expect, it } from 'vitest';
import { enriquecer } from '../server/analyze';
import { resumirAlteracoes } from '../shared/registro';
import { AdmissibilityAnalysisResultSchema, type ModelOutput, type Sobrestamento } from '../shared/schema';
import { avisosSobrestamento, conclusaoSugerida, linkTema, novoTemaManual, obterSobrestamento, sobrestamentoInicial } from '../shared/sobrestamento';
import sample from '../server/fixtures/sample-case.json';

const base = () => enriquecer(sample as ModelOutput, { provedor: 'exemplo', modelo: 'x', geradoEm: '2026-11-13T00:00:00Z' });
const tema = (p: Partial<Sobrestamento['temas'][number]>) => ({ ...novoTemaManual('STJ', 'repetitivo', '1234', []), ...p });

describe('registro inicial', () => {
  it('converte as indicações da IA em temas a verificar, sem decidir', () => {
    const s = sobrestamentoInicial({
      temasRepetitivos: [
        { tribunal: 'STJ', especie: 'repetitivo', numero: '1.234', questao: 'q', pertinencia: 'p', suspensao: 'desconhecida', situacao: 'afetado_pendente' },
        { tribunal: 'STJ', especie: 'repetitivo', numero: '1234', questao: 'duplicado', pertinencia: 'p', suspensao: 'determinada', situacao: 'afetado_pendente' },
      ],
    });
    expect(s.conclusao).toBe('nao_verificado');
    expect(s.temas).toHaveLength(1);
    expect(s.temas[0]).toMatchObject({ origem: 'ia', suspensao: 'a_conferir', enquadramento: 'a_verificar' });
  });

  it('é gerado na análise e vale para registros antigos sem o campo', () => {
    const d = base();
    expect(d.sobrestamento?.temas.map((t) => t.id)).toEqual(['STJ-466', 'STF-660']);
    const antigo = { ...d, sobrestamento: undefined };
    expect(obterSobrestamento(antigo).temas).toHaveLength(2);
    expect(AdmissibilityAnalysisResultSchema.safeParse(d).success).toBe(true);
  });
});

describe('conclusão sugerida', () => {
  it('sobrestar quando a matéria se insere em tema com suspensão', () => {
    expect(conclusaoSugerida({ conclusao: 'nao_verificado', temas: [tema({ enquadramento: 'se_insere', suspensao: 'determinada' })] })).toBe('sobrestar');
  });
  it('aguarda enquanto houver tema a verificar', () => {
    expect(conclusaoSugerida({ conclusao: 'nao_verificado', temas: [tema({})] })).toBeNull();
  });
  it('sem tema pertinente', () => {
    expect(conclusaoSugerida({ conclusao: 'nao_verificado', temas: [] })).toBe('nao_ha_tema');
    expect(conclusaoSugerida({ conclusao: 'nao_verificado', temas: [tema({ enquadramento: 'nao_se_insere' })] })).toBe('nao_ha_tema');
  });
  it('tema pertinente sem suspensão', () => {
    expect(conclusaoSugerida({ conclusao: 'nao_verificado', temas: [tema({ enquadramento: 'se_insere', suspensao: 'nao_determinada' })] })).toBe('tema_sem_suspensao');
  });
});

describe('avisos de coerência', () => {
  it('cobra o art. 1.030, III na minuta quando se conclui pelo sobrestamento', () => {
    const d = base();
    d.sobrestamento = { conclusao: 'sobrestar', temas: [tema({ enquadramento: 'se_insere', suspensao: 'determinada' })] };
    expect(avisosSobrestamento(d).join(' ')).toMatch(/minuta não prevê/);
    d.minutaDecisao1VP = { ...d.minutaDecisao1VP, dispositivoFinal: 'Determino o sobrestamento do recurso especial (art. 1.030, III, do CPC).' };
    expect(avisosSobrestamento(d)).toEqual([]);
  });

  it('aponta conclusão divergente dos temas', () => {
    const d = base();
    d.sobrestamento = { conclusao: 'nao_ha_tema', temas: [tema({ enquadramento: 'se_insere', suspensao: 'determinada' })] };
    expect(avisosSobrestamento(d)[0]).toMatch(/difere/);
  });
});

it('links oficiais por tribunal', () => {
  expect(linkTema({ tribunal: 'STJ', numero: '1.234' })).toContain('cod_tema_inicial=1234');
  expect(linkTema({ tribunal: 'STF', numero: '660' })).toContain('tema.asp?num=660');
});

it('histórico registra a mudança de conclusão', () => {
  const a = base();
  const b = { ...a, sobrestamento: { ...a.sobrestamento!, conclusao: 'sobrestar' as const } };
  expect(resumirAlteracoes(a, b)).toContain('Sobrestamento: sobrestar o recurso (art. 1.030, iii)');
});

it('cabeçalho da minuta sem o timbre repetido', async () => {
  const { cabecalhoSemTimbre } = await import('../shared/minuta');
  expect(cabecalhoSemTimbre('TRIBUNAL DE JUSTIÇA DO ESTADO DO PARANÁ\n1ª VICE-PRESIDÊNCIA\nAutos nº 1\nRecorrente: X')).toBe('Autos nº 1\nRecorrente: X');
  expect(cabecalhoSemTimbre('Autos nº 1')).toBe('Autos nº 1');
});
