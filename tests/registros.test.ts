import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { beforeAll, describe, expect, it } from 'vitest';
import sample from '../server/fixtures/sample-case.json';
import { resumirAlteracoes, validarCNJ, type RegistroDados } from '../shared/registro';
import { enriquecer } from '../server/analyze';
import { criarSessao, hashSenha, lerSessao, verificarSenha } from '../server/auth';
import { criarStoreMemoria } from '../server/store/memory';
import type { ModelOutput } from '../shared/schema';

process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';
const dadosBase = (): RegistroDados => enriquecer(sample as unknown as ModelOutput, { provedor: 'gemini', modelo: 'x', geradoEm: '2026-11-12T00:00:00.000Z' });

describe('validação do número do processo (CNJ)', () => {
  it('confere o dígito verificador', () => {
    expect(validarCNJ('0008645-47.2026.8.16.0045').valido).toBe(true);
    expect(validarCNJ('0010045-96.2026.8.16.0045').valido).toBe(true);
    expect(validarCNJ('0008645-48.2026.8.16.0045').valido).toBe(false);
    expect(validarCNJ('123').valido).toBe(false);
    expect(validarCNJ(dadosBase().processo.numero).valido).toBe(true); // exemplo do sistema
  });
});

describe('senhas e sessões', () => {
  it('faz hash com sal e verifica', async () => {
    const h = await hashSenha('uma-senha-bem-longa');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verificarSenha('uma-senha-bem-longa', h)).toBe(true);
    expect(await verificarSenha('outra-senha-qualquer', h)).toBe(false);
  });
  it('assina o token e rejeita adulteração e expiração', () => {
    const t = criarSessao('u1');
    expect(lerSessao(t)?.uid).toBe('u1');
    expect(lerSessao(t.replace('u1', 'u2'))).toBeNull();
    expect(lerSessao(t.slice(0, -2) + 'xx')).toBeNull();
    expect(lerSessao(t, Date.now() + 13 * 3600 * 1000)).toBeNull();
    expect(lerSessao(undefined)).toBeNull();
  });
});

describe('persistência em arquivo', () => {
  it('mantém os dados após reiniciar', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-'));
    const arq = path.join(dir, 'r.json');
    const a = criarStoreMemoria(arq);
    const d = dadosBase();
    const autor = { id: 'u1', nome: 'Ana' };
    await a.casos.criar({ id: 'c1', numeroProcesso: d.processo.numero, materia: d.processo.materia, status: 'em_analise', versao: 1, criadoPor: autor, criadoEm: 'x', atualizadoPor: autor, atualizadoEm: 'x', dados: d });
    await new Promise((r) => setTimeout(r, 200));
    const b = criarStoreMemoria(arq);
    expect((await b.casos.obter('c1'))?.numeroProcesso).toBe(d.processo.numero);
    expect((await b.casos.historico('c1')).length).toBe(1);
  });
});

describe('API de registros (multiusuário)', () => {
  let base = '';
  const cookies: Record<string, string> = {};
  const h = (u: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-requested-with': 'fetch', cookie: cookies[u] ?? '', ...extra });
  const api = (u: string, metodo: string, url: string, corpo?: unknown) => fetch(`${base}${url}`, { method: metodo, headers: h(u), body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const json = async (r: Response) => ({ status: r.status, ...(await r.json()) });

  beforeAll(async () => {
    const { createApp } = await import('../server/index');
    const store = criarStoreMemoria();
    const mk = async (id: string, nome: string, papel: 'admin' | 'assessor', ativo = true) =>
      store.usuarios.criar({ id, email: `${id}@tjpr.test`, nome, papel, ativo, senhaHash: await hashSenha('senha-longa-123'), criadoEm: '', atualizadoEm: '' });
    await mk('ana', 'Ana', 'admin');
    await mk('beto', 'Beto', 'assessor');
    await mk('carla', 'Carla', 'assessor', false);
    const srv = createApp(store).listen(0);
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    for (const u of ['ana', 'beto']) {
      const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: h(''), body: JSON.stringify({ email: `${u}@tjpr.test`, senha: 'senha-longa-123' }) });
      cookies[u] = (r.headers.get('set-cookie') ?? '').split(';')[0];
    }
  });

  it('login: rejeita senha errada e usuário desativado; cookie é HttpOnly/SameSite', async () => {
    const ruim = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: h(''), body: JSON.stringify({ email: 'ana@tjpr.test', senha: 'errada' }) });
    expect(ruim.status).toBe(401);
    const off = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: h(''), body: JSON.stringify({ email: 'carla@tjpr.test', senha: 'senha-longa-123' }) });
    expect(off.status).toBe(401);
    const ok = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: h(''), body: JSON.stringify({ email: 'ana@tjpr.test', senha: 'senha-longa-123' }) });
    const sc = ok.headers.get('set-cookie') ?? '';
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Strict/);
    expect((await (await api('ana', 'GET', '/api/auth/me')).json()).usuario.email).toBe('ana@tjpr.test');
    expect((await api('', 'GET', '/api/auth/me')).status).toBe(401);
  });

  it('exige o cabeçalho anti-CSRF nas escritas', async () => {
    const r = await fetch(`${base}/api/casos`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookies.ana }, body: '{}' });
    expect(r.status).toBe(400);
  });

  it('só administradores gerenciam usuários; senha fraca é recusada', async () => {
    expect((await api('beto', 'GET', '/api/usuarios')).status).toBe(403);
    expect((await api('ana', 'POST', '/api/usuarios', { email: 'd@tjpr.test', nome: 'Davi', senha: 'curta', papel: 'assessor' })).status).toBe(400);
    const ok = await json(await api('ana', 'POST', '/api/usuarios', { email: 'D@tjpr.test', nome: 'Davi', senha: 'senha-bem-longa-1', papel: 'assessor' }));
    expect(ok.status).toBe(201);
    expect(ok.usuario.senhaHash).toBeUndefined();
    expect((await api('ana', 'POST', '/api/usuarios', { email: 'd@tjpr.test', nome: 'Davi 2', senha: 'senha-bem-longa-1' })).status).toBe(409);
    const meu = (await (await api('ana', 'GET', '/api/auth/me')).json()).usuario.id;
    expect((await api('ana', 'PATCH', `/api/usuarios/${meu}`, { ativo: false })).status).toBe(400);
  });

  let id = '';
  it('cria o registro só com dados extraídos: descarta campos de arquivo e recalcula os derivados', async () => {
    const d = dadosBase() as Record<string, unknown>;
    d.textoIntegral = 'TEXTO DOS AUTOS';
    d.dataBase64 = 'JVBERi0=';
    d.verificacoes = { prazos: [], relevancia: { forjada: true }, avisos: [] }; // lixo vindo do cliente
    d.precedentes = [];
    const r = await json(await api('ana', 'POST', '/api/casos', { dados: d }));
    expect(r.status).toBe(201);
    id = r.caso.id;
    expect(r.caso.versao).toBe(1);
    const gravado = JSON.stringify(r.caso);
    expect(gravado).not.toContain('TEXTO DOS AUTOS');
    expect(gravado).not.toContain('JVBERi0=');
    expect(r.caso.dados.verificacoes.prazos.length).toBe(2); // recalculado no servidor
    expect(r.caso.dados.precedentes.length).toBeGreaterThan(5);
    expect(r.caso.criadoPor.nome).toBe('Ana');
  });

  it('um registro por processo; número inválido é recusado', async () => {
    const dup = await json(await api('beto', 'POST', '/api/casos', { dados: dadosBase() }));
    expect(dup.status).toBe(409);
    expect(dup.codigo).toBe('numero_duplicado');
    expect(dup.existente.id).toBe(id);
    const d = dadosBase();
    d.processo.numero = '0008645-48.2026.8.16.0045';
    const inv = await json(await api('beto', 'POST', '/api/casos', { dados: d }));
    expect(inv.status).toBe(400);
    expect(inv.codigo).toBe('numero_invalido');
  });

  it('outro usuário vê e edita; histórico registra autor e resumo', async () => {
    const atual = (await json(await api('beto', 'GET', `/api/casos/${id}`))).caso;
    const d = structuredClone(atual.dados) as RegistroDados;
    d.checklistSecoes[0].itens[0].observacaoAssessor = 'ressalva do Beto';
    d.minutaDecisao1VP.dispositivoFinal += '\nAjuste.';
    const r = await json(await api('beto', 'PUT', `/api/casos/${id}`, { baseVersao: 1, dados: d, status: 'revisado' }));
    expect(r.status).toBe(200);
    expect(r.caso.versao).toBe(2);
    expect(r.caso.atualizadoPor.nome).toBe('Beto');
    const hist = (await json(await api('ana', 'GET', `/api/casos/${id}/historico`))).historico;
    expect(hist.map((x: { versao: number }) => x.versao)).toEqual([2, 1]);
    expect(hist[0].resumo.join(' ')).toMatch(/anotação/);
    expect(hist[0].resumo.join(' ')).toMatch(/dispositivo/);
    expect(hist[0].resumo.join(' ')).toMatch(/Status/);
  });

  it('detecta conflito de versão (edição concorrente) e não perde dados', async () => {
    const atual = (await json(await api('ana', 'GET', `/api/casos/${id}`))).caso;
    const d = structuredClone(atual.dados) as RegistroDados;
    d.diagnosticoGeral.resumoParecer = 'texto da Ana';
    const velho = await json(await api('ana', 'PUT', `/api/casos/${id}`, { baseVersao: 1, dados: d }));
    expect(velho.status).toBe(409);
    expect(velho.codigo).toBe('conflito');
    expect(velho.atual.versao).toBe(2);
    expect(velho.atual.atualizadoPor.nome).toBe('Beto');
    const ok = await json(await api('ana', 'PUT', `/api/casos/${id}`, { baseVersao: 2, dados: d }));
    expect(ok.caso.versao).toBe(3);
  });

  it('salvar sem mudanças não cria versão', async () => {
    const atual = (await json(await api('ana', 'GET', `/api/casos/${id}`))).caso;
    const r = await json(await api('ana', 'PUT', `/api/casos/${id}`, { baseVersao: atual.versao, dados: atual.dados }));
    expect(r.caso.versao).toBe(atual.versao);
  });

  it('restaura uma versão anterior como nova versão', async () => {
    const v1 = (await json(await api('ana', 'GET', `/api/casos/${id}/historico/1`))).dados;
    const atual = (await json(await api('ana', 'GET', `/api/casos/${id}`))).caso;
    const r = await json(await api('ana', 'PUT', `/api/casos/${id}`, { baseVersao: atual.versao, dados: v1 }));
    expect(r.caso.versao).toBe(atual.versao + 1);
    expect(r.caso.dados.checklistSecoes[0].itens[0].observacaoAssessor).toBeUndefined();
  });

  it('base compartilhada de precedentes vale para todos os registros', async () => {
    const antes = (await json(await api('ana', 'GET', `/api/casos/${id}`))).caso.dados.precedentes.find((c: { rotulo: string }) => c.rotulo === 'Tema 466/STJ');
    expect(antes.verificacao.status).toBe('requer_conferencia');
    const p = await json(await api('beto', 'POST', '/api/base-precedentes', { entradas: [{ tipo: 'tema', tribunal: 'STJ', numero: '466', enunciado: 'Tese cadastrada pelo Beto', situacao: 'vigente' }] }));
    expect(p.entradas[0].atualizadoPor.nome).toBe('Beto');
    await new Promise((r) => setTimeout(r, 0));
    // cache da base expira; força regravação com uma alteração real para recalcular
    const atual = (await json(await api('ana', 'GET', `/api/casos/${id}`))).caso;
    const d = structuredClone(atual.dados) as RegistroDados;
    d.diagnosticoGeral.resumoParecer += ' ';
    const r = await json(await api('ana', 'PUT', `/api/casos/${id}`, { baseVersao: atual.versao, dados: d }));
    const dep = r.caso.dados.precedentes.find((c: { rotulo: string }) => c.rotulo === 'Tema 466/STJ');
    expect(dep.verificacao.status).toBe('confirmada');
    expect((await api('beto', 'DELETE', '/api/base-precedentes?tipo=tema&tribunal=STJ&numero=466')).status).toBe(403);
  });

  it('exclusão: só o autor ou administrador', async () => {
    expect((await api('beto', 'DELETE', `/api/casos/${id}`)).status).toBe(403);
    const lista = (await json(await api('beto', 'GET', '/api/casos?busca=0014298'))).casos;
    expect(lista.length).toBe(1);
    expect((await api('ana', 'DELETE', `/api/casos/${id}`)).status).toBe(200);
    expect((await api('ana', 'GET', `/api/casos/${id}`)).status).toBe(404);
  });
});

describe('resumo de alterações', () => {
  it('descreve criação e mudanças', () => {
    const a = dadosBase();
    expect(resumirAlteracoes(null, a)).toEqual(['Registro criado']);
    const b = structuredClone(a);
    b.processo.dataPublicacaoAcordao = '16/09/2026';
    b.minutaDecisao1VP.relatorio += ' x';
    const r = resumirAlteracoes(a, b).join('|');
    expect(r).toMatch(/Dados do processo: dataPublicacaoAcordao/);
    expect(r).toMatch(/Minuta: relatório/);
    expect(resumirAlteracoes(a, structuredClone(a))).toEqual([]);
  });
});
