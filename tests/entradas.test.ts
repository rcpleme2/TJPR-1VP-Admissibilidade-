import { describe, expect, it } from 'vitest';
import sample from '../server/fixtures/sample-case.json';
import { verificarPrazos } from '../shared/prazos';
import { consultarBase } from '../shared/consulta';
import { extrairDataProtocolo } from '../shared/protocolo';
import { estimarTokensPdf, estimarTokensTexto, montarMarkdown, pareceEscaneado } from '../shared/textoPdf';
import { EntradasPrazoSchema, type ModelOutput } from '../shared/schema';

const base = sample as unknown as ModelOutput;
const ent = (p: object = {}) => EntradasPrazoSchema.parse({ feriadosRespondido: true, ...p });

describe('prazos com dados informados pelo usuário', () => {
  it('a intimação do usuário prevalece sobre a extraída', () => {
    const semEmb = { ...base, processo: { ...base.processo, houveEmbargosDeclaracao: false, dataPublicacaoEmbargos: undefined } };
    const v = verificarPrazos(semEmb, ent({ dataIntimacaoAcordao: '2026-09-18' }));
    expect(v.prazos[0].dataBase).toBe('18/09/2026');
    expect(v.prazos[0].fonteBase).toMatch(/usuário/);
  });

  it('feriados informados deslocam o prazo', () => {
    const sem = verificarPrazos(base, ent());
    const com = verificarPrazos(base, ent({ feriados: [{ data: '2026-10-20' }] }));
    expect(sem.prazos[0].dataLimite).toBe('30/10/2026');
    expect(com.prazos[0].dataLimite).toBe('03/11/2026'); // 30/10 + 2/11 (feriado) → 3/11
    expect(com.avisos.some((a) => a.includes('20/10/2026'))).toBe(true);
  });

  it('avisa quando os feriados não foram respondidos', () => {
    expect(verificarPrazos(base, { feriadosRespondido: false }).avisos.some((a) => a.includes('Feriados locais'))).toBe(true);
    expect(verificarPrazos(base, ent()).avisos.some((a) => a.includes('Feriados locais'))).toBe(false);
  });

  it('interposição: usuário > protocolo do PDF > IA, com alerta de divergência', () => {
    const r = { ...base, recursosAnalisados: [{ ...base.recursosAnalisados[0], tipo: 'Recurso Especial (REsp)', dataInterposicao: '28/10/2026' }] };
    const prot = [{ arquivo: 'resp.pdf', papel: 'recurso_especial' as const, data: '30/10/2026', pagina: 2, trecho: 'Protocolado em 30/10/2026' }];
    const v = verificarPrazos(r, ent({ protocolos: prot }));
    expect(v.prazos[0].dataInterposicao).toBe('30/10/2026');
    expect(v.prazos[0].fonteInterposicao).toMatch(/protocolo/);
    expect(v.avisos.some((a) => a.includes('carimbo de protocolo'))).toBe(true);
    const manual = verificarPrazos(r, ent({ protocolos: prot, interposicaoManual: { [r.recursosAnalisados[0].id]: '2026-11-10' } }));
    expect(manual.prazos[0].dataInterposicao).toBe('10/11/2026');
    expect(manual.prazos[0].status).toBe('tempestivo_se_prazo_dobro');
  });
});

describe('detecção do protocolo no texto do PDF', () => {
  it('encontra o carimbo com rótulo explícito', () => {
    const paginas = ['EXCELENTÍSSIMO SENHOR\nCuritiba, 20 de outubro de 2026', 'texto', 'texto', 'Protocolado em 30/10/2026 às 14:22\nAssinado por ...'];
    const r = extrairDataProtocolo(paginas)!;
    expect(r.data).toBe('30/10/2026');
    expect(r.pagina).toBe(4);
  });
  it('ignora datas sem rótulo de protocolo e datas inválidas', () => {
    expect(extrairDataProtocolo(['Em 12/03/2026 foi proferida a decisão', 'Protocolo: 31/02/2026'])).toBeNull();
  });
});

describe('conversão de PDF em Markdown', () => {
  const w = ['alfa', 'beta', 'gama', 'delta', 'epsilon'];
  const pagina = (n: number) => [
    'TRIBUNAL DE JUSTIÇA DO PARANÁ',
    `Página ${n} de 5`,
    `Abertura ${w[n - 1]} do texto.`,
    `Segunda linha ${w[n - 1]} do corpo.`,
    `Corpo ${w[n - 1]} com infor-`,
    'mação importante que continua',
    'na linha seguinte.',
    `Penúltima ${w[n - 1]}.`,
    `Última ${w[n - 1]} do corpo.`,
    `Mais uma ${w[n - 1]}.`,
  ];
  const r = montarMarkdown([1, 2, 3, 4, 5].map(pagina));
  it('remove cabeçalhos/rodapés repetidos e junta linhas', () => {
    expect((r.texto.match(/TRIBUNAL DE JUSTIÇA/g) ?? []).length).toBe(1); // uma única vez, no topo
    expect((r.texto.match(/Página \d de 5/g) ?? []).length).toBe(1);
    expect(r.texto).toContain('informação importante que continua na linha seguinte.');
    expect(r.linhasRepetidasRemovidas).toBe(10);
  });
  it('marca páginas e reduz o volume estimado de tokens', () => {
    expect(r.texto).toContain('[p. 3]');
    expect(estimarTokensTexto(r.caracteres)).toBeLessThan(estimarTokensPdf(r.paginas));
  });
  it('identifica PDF escaneado', () => {
    expect(pareceEscaneado(montarMarkdown([[''], [''], ['']]))).toBe(true);
    expect(pareceEscaneado(r)).toBe(false);
  });
});

describe('consulta de súmulas', () => {
  it('encontra por número, citação e palavras', () => {
    expect(consultarBase('7').resultados.map((x) => x.rotulo)).toContain('Súmula 7/STJ');
    expect(consultarBase('súmula 7 stj').resultados.map((x) => x.rotulo)).toEqual(['Súmula 7/STJ']);
    expect(consultarBase('SV 10').resultados.map((x) => x.rotulo)).toEqual(['Súmula Vinculante 10']);
    expect(consultarBase('reexame de prova').resultados.length).toBeGreaterThanOrEqual(2);
    expect(consultarBase('prequestionamento stf').resultados.every((x) => x.entrada.tribunal === 'STF')).toBe(true);
  });
  it('indica números fora da base e inexistentes', () => {
    const r = consultarBase('súmula 999 stf');
    expect(r.resultados).toHaveLength(0);
    expect(r.naoEncontrados[0].verificacao.status).toBe('inexistente');
    expect(consultarBase('súmula 300 stj').naoEncontrados[0].verificacao.status).toBe('nao_encontrada_na_base');
  });
  it('inclui a base do usuário e respeita filtros', () => {
    const custom = [{ tipo: 'tema' as const, tribunal: 'STJ' as const, numero: '466', enunciado: 'Tese de teste', situacao: 'vigente' as const, palavrasChave: [], fonte: 'usuario' as const }];
    const r = consultarBase('tema 466', custom);
    expect(r.resultados[0].noUsuario).toBe(true);
    expect(consultarBase('', custom, { tipo: 'tema' }).resultados).toHaveLength(1);
  });
});

describe('carimbo do Projudi (protocolo)', () => {
  // estrutura reproduzida do exemplo real (dados fictícios): o carimbo aparece no fim de CADA página
  const carimbo = (data = '20/07/2026') => [
    'Documento assinado digitalmente, conforme MP nº 2.200-2/2001, Lei nº 11.419/2006, resolução do Projudi, do TJPR/OE',
    'Validação deste em https://projudi.tjpr.jus.br/projudi/ - Identificador: ABCDE FGHIJ KLMNO PQRST',
    'PROJUDI - Recurso: 0010045-96.2026.8.16.0045 - Ref. mov. 1.1 - Assinado digitalmente por Fulano de Tal:00000000000',
    `${data}: JUNTADA DE PETIÇÃO DE RECURSO ESPECIAL. Arq: Petição`,
  ];
  const corpo = (n: number) => [`Texto exclusivo ${['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta'][n]} um`, `segunda ${['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta'][n]} dois`, 'a Recorrente foi intimada em 29/06/2026 com término em 20/07/2026.', `quarta ${['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta'][n]}`, `quinta ${['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta'][n]}`];
  const paginas = [0, 1, 2, 3, 4, 5].map((n) => [...corpo(n), ...carimbo()]);

  it('lê a data, o movimento e a referência do carimbo', () => {
    const r = extrairDataProtocolo(paginas.map((l) => l.join('\n')))!;
    expect(r.data).toBe('20/07/2026');
    expect(r.sistema).toBe('projudi');
    expect(r.movimento).toBe('RECURSO ESPECIAL');
    expect(r.referencia).toBe('Recurso 0010045-96.2026.8.16.0045 · mov. 1.1');
    expect(r.pagina).toBe(1);
  });

  it('não confunde com as datas citadas no corpo da petição', () => {
    const r = extrairDataProtocolo(paginas.map((l) => l.join('\n')))!;
    expect(r.data).not.toBe('29/06/2026');
    expect(r.data).not.toBe('30/06/2026');
  });

  it('usa a data mais frequente se houver carimbos diferentes', () => {
    const mistas = paginas.map((l, i) => (i === 0 ? [...corpo(0), ...carimbo('15/07/2026')] : l).join('\n'));
    expect(extrairDataProtocolo(mistas)!.data).toBe('20/07/2026');
  });

  it('verifica a compatibilidade do movimento com o papel do arquivo', async () => {
    const { movimentoCompativel } = await import('../shared/protocolo');
    expect(movimentoCompativel('recurso_especial', 'RECURSO ESPECIAL')).toBe(true);
    expect(movimentoCompativel('recurso_extraordinario', 'RECURSO ESPECIAL')).toBe(false);
    expect(movimentoCompativel('recurso_especial', 'PETIÇÃO INTERMEDIÁRIA')).toBeNull();
  });

  it('o carimbo repetido vai uma vez para o topo do Markdown e não se perde', () => {
    const md = montarMarkdown(paginas);
    expect(md.texto.startsWith('[Cabeçalho/rodapé repetido')).toBe(true);
    expect(md.texto).toContain('20/07/2026: JUNTADA DE PETIÇÃO DE RECURSO ESPECIAL');
    expect((md.texto.match(/JUNTADA DE PETIÇÃO/g) ?? []).length).toBe(1);
    expect(md.texto).toContain('[p. 6]');
  });

  it('carimbos com datas diferentes não são tratados como repetição', () => {
    const md = montarMarkdown([0, 1, 2, 3].map((n) => [...corpo(n), ...carimbo(`0${n + 1}/07/2026`)]));
    expect(md.texto).toContain('01/07/2026: JUNTADA');
    expect(md.texto).toContain('04/07/2026: JUNTADA');
  });
});
