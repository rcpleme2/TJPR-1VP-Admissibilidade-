import { describe, expect, it } from 'vitest';
import { buscarTemas, faseDaSituacao, indexar, lerCsv, lerTemasStj, suspensaoDoTexto, temaPorNumero, temasCitados } from '../shared/temasStj';
import { sobrestamentoInicial } from '../shared/sobrestamento';

const CAB =
  'sequencialPrecedente,tipoPrecedente,numeroPrecedente,dataPrimeiraAfetacao,dataJulgamento,dataPublicacaoAcordao,situacao,informacoesComplementares,questaoSubmetidaAJulgamento,teseFirmada,anotacoesNUGEPNAC,delimitacaoJulgado,entendimentoAnterior,referenciaLegislativa,referenciaSumular,sumulaOriginada,audienciaPublica,dataAudienciaPublica,orgaoJulgador,Assuntos,numeroRepercussaoGeralSTF,descricaoRepercussaoGeral';
const linha = (tipo: string, n: string, sit: string, info: string, q: string, tese = '') => `1,${tipo},${n},2024-01-01,,,${sit},"${info}","${q}","${tese}",,,,,,,N,,S2,"123- Assunto",,`;
const CSV = [
  CAB,
  linha('Tema', '466', 'Trânsito em Julgado', '', 'Responsabilidade civil da instituição financeira por fraude praticada por terceiros, fortuito interno.', 'As instituições financeiras respondem objetivamente.'),
  linha('Controvérsia', '466', 'Cancelada', '', 'Outra coisa'),
  linha('Tema', '1300', 'Afetado', 'Há determinação de suspensão do processamento de todos os processos pendentes.', 'Definir se é válida a cobrança de tarifa de cadastro em contratos bancários, ""com aspas"".'),
  linha('Tema', '1301', 'Afetado', 'Sem a determinação de suspensão dos processos pendentes.', 'Prescrição de pretensão indenizatória contra seguradora.'),
  linha('', '1475', 'Relevância reconhecida', 'Há determinação de suspensão, em âmbito nacional.', 'Periculosidade por eletricidade para aposentadoria especial.'),
  linha('', '1475', 'Relevância reconhecida', 'Há determinação de suspensão, em âmbito nacional.', 'Periculosidade por eletricidade para aposentadoria especial.'),
].join('\r\n');

describe('base de temas do STJ', () => {
  it('lê o CSV com aspas e quebras de linha', () => {
    expect(lerCsv('a,b\n"x, ""y""","z\nw"\n')).toEqual([['a', 'b'], ['x, "y"', 'z\nw']]);
  });

  it('separa repetitivos e relevância, sem controvérsias nem repetições', () => {
    const t = lerTemasStj(CSV);
    expect(t.map((x) => `${x.especie}:${x.numero}`)).toEqual(['repetitivo:466', 'repetitivo:1300', 'repetitivo:1301', 'relevancia:1475']);
    expect(t[1].questao).toContain('"com aspas"');
  });

  it('classifica situação e ordem de suspensão', () => {
    expect(faseDaSituacao('Afetado')).toBe('pendente');
    expect(faseDaSituacao('Relevância reconhecida')).toBe('pendente');
    expect(faseDaSituacao('Acórdão Publicado - RE Pendente')).toBe('julgado');
    expect(faseDaSituacao('Cancelado')).toBe('cancelado');
    expect(suspensaoDoTexto('Há determinação de suspensão nacional')).toBe('determinada');
    expect(suspensaoDoTexto('Sem a determinação de suspensão dos processos pendentes.')).toBe('nao_determinada');
    expect(suspensaoDoTexto('Não aplicação do disposto na parte final do § 1º do art. 1.036')).toBe('nao_determinada');
    expect(suspensaoDoTexto('')).toBe('nao_informada');
  });

  it('acha temas pela questão de direito e pelo número', () => {
    const idx = indexar(lerTemasStj(CSV));
    expect(buscarTemas(idx, 'O banco cobrou tarifa de cadastro no contrato bancário de financiamento.')[0].numero).toBe('1300');
    expect(buscarTemas(idx, 'fraude de terceiros contra instituição financeira')[0].numero).toBe('466');
    expect(temaPorNumero(idx, '1.475')?.especie).toBe('relevancia');
    expect(temasCitados('aplica-se o Tema 466/STJ e o Tema Repetitivo n. 1.300')).toEqual(['466', '1300']);
  });

  it('confere os temas da IA na base e marca "não afetada" quando nada justifica sobrestar', () => {
    const base = indexar(lerTemasStj(CSV));
    const tema = (numero: string, situacao: 'afetado_pendente' | 'julgado' | 'desconhecida' = 'desconhecida') =>
      ({ tribunal: 'STJ' as const, especie: 'repetitivo' as const, numero, questao: 'x', pertinencia: 'y', suspensao: 'desconhecida' as const, situacao });
    const julgado = sobrestamentoInicial({ temasRepetitivos: [tema('466', 'afetado_pendente')] }, { base, consultadoEm: '2026-11-17' });
    expect(julgado.temas[0].situacao).toBe('julgado'); // a base corrige a IA
    expect(julgado.temas[0].oficial?.tese).toContain('objetivamente');
    expect(julgado.conclusao).toBe('nao_ha_tema');
    expect(julgado.automatica).toBe(true);

    const pendente = sobrestamentoInicial({ temasRepetitivos: [tema('1300')] }, { base, consultadoEm: '2026-11-17' });
    expect(pendente.temas[0].suspensao).toBe('determinada');
    expect(pendente.conclusao).toBe('nao_verificado');

    const inexistente = sobrestamentoInicial({ temasRepetitivos: [tema('9999')] }, { base, consultadoEm: '2026-11-17' });
    expect(inexistente.temas[0].foraDaBase).toBe(true);

    expect(sobrestamentoInicial({ temasRepetitivos: [] }).conclusao).toBe('nao_ha_tema');
  });
});
