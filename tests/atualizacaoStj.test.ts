import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _reiniciarBaseStj, baseStj, configurarBaseStj, deveBaixar, diaDeAtualizar, noRecesso } from '../server/temasStj';
import { criarStoreMemoria } from '../server/store/memory';

// datas em UTC; Brasília = UTC-3
const em = (iso: string) => new Date(iso);

describe('calendário de atualização da base do STJ', () => {
  it('só às sextas, fora do recesso de 20/12 a 06/01', () => {
    expect(diaDeAtualizar(em('2026-11-20T15:00:00Z'))).toBe(true); // sexta
    expect(diaDeAtualizar(em('2026-11-19T15:00:00Z'))).toBe(false); // quinta
    expect(diaDeAtualizar(em('2026-11-21T01:00:00Z'))).toBe(true); // sábado em UTC, ainda sexta em Brasília
    expect(diaDeAtualizar(em('2026-12-25T15:00:00Z'))).toBe(false); // sexta no recesso
    expect(diaDeAtualizar(em('2027-01-01T15:00:00Z'))).toBe(false); // sexta no recesso
    expect(diaDeAtualizar(em('2027-01-08T15:00:00Z'))).toBe(true); // primeira sexta depois do recesso
    expect(noRecesso('2026-12-19')).toBe(false);
    expect(noRecesso('2026-12-20')).toBe(true);
    expect(noRecesso('2027-01-06')).toBe(true);
    expect(noRecesso('2027-01-07')).toBe(false);
  });

  it('baixa sem cópia; na sexta, uma vez por dia; nos outros dias, nunca', () => {
    expect(deveBaixar(em('2026-11-18T15:00:00Z'), null)).toBe(true);
    expect(deveBaixar(em('2026-11-18T15:00:00Z'), '2026-10-01T12:00:00Z')).toBe(false); // quarta, cópia velha: espera a sexta
    expect(deveBaixar(em('2026-11-20T15:00:00Z'), '2026-11-13T12:00:00Z')).toBe(true); // sexta, cópia da semana passada
    expect(deveBaixar(em('2026-11-20T18:00:00Z'), '2026-11-20T12:00:00Z')).toBe(false); // já baixada nesta sexta
    expect(deveBaixar(em('2026-12-25T15:00:00Z'), '2026-12-18T12:00:00Z')).toBe(false); // recesso
  });
});

describe('cópia guardada da base', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.STJ_TEMAS_ARQUIVO;
    _reiniciarBaseStj();
  });

  const csv = (questao: string) => {
    const cab = 'sequencialPrecedente,tipoPrecedente,numeroPrecedente,dataPrimeiraAfetacao,dataJulgamento,dataPublicacaoAcordao,situacao,informacoesComplementares,questaoSubmetidaAJulgamento,teseFirmada,orgaoJulgador,Assuntos';
    const linhas = Array.from({ length: 120 }, (_, i) => `${i},Tema,${i + 1},,,,Afetado,,"${questao} ${i}",,S1,`);
    return [cab, ...linhas].join('\n');
  };

  it('baixa na primeira vez, guarda, e uma instância nova lê a cópia sem baixar', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stj-'));
    const arq = path.join(dir, 'temas.csv');
    fs.writeFileSync(arq, csv('versão um'));
    process.env.STJ_TEMAS_ARQUIVO = arq;
    const store = criarStoreMemoria(path.join(dir, 'r.json'));
    configurarBaseStj(store);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(em('2026-11-18T15:00:00Z')); // quarta
    const b1 = await baseStj();
    expect(b1?.indice.temas[0].questao).toContain('versão um');
    expect(await store.arquivos.ler('temas-stj.csv.gz')).not.toBeNull();

    // o STJ publica outra versão; numa quinta, a instância nova usa a cópia guardada
    fs.writeFileSync(arq, csv('versão dois'));
    _reiniciarBaseStj();
    configurarBaseStj(criarStoreMemoria(path.join(dir, 'r.json')));
    vi.setSystemTime(em('2026-11-19T15:00:00Z'));
    expect((await baseStj())?.indice.temas[0].questao).toContain('versão um');

    // na sexta, atualiza
    vi.setSystemTime(em('2026-11-20T15:00:00Z'));
    await baseStj(); // dispara a atualização em segundo plano
    await vi.waitFor(async () => expect((await baseStj())?.indice.temas[0].questao).toContain('versão dois'));
  });
});
