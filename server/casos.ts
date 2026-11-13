import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { verificarPrazos } from '../shared/prazos';
import { chaveBase } from '../shared/precedentes';
import { verificarResultado } from '../shared/precedentes';
import type { EntradaBase } from '../shared/precedentesBase';
import {
  MAX_BYTES_REGISTRO,
  RegistroAtualizacaoSchema,
  RegistroNovoSchema,
  resumirAlteracoes,
  validarCNJ,
  type Autor,
  type Caso,
  type RegistroDados,
} from '../shared/registro';
import { EntradasPrazoSchema } from '../shared/schema';
import type { Store } from './store/types';

/**
 * Forma canônica de um registro: os campos DERIVADOS (prazos e verificação de precedentes) são sempre
 * recalculados no servidor a partir dos dados extraídos/cadastrados e da base compartilhada, de modo que
 * todos os usuários vejam o mesmo resultado, qualquer que seja o cliente que gravou.
 */
export function canonizar(dados: RegistroDados, baseCompartilhada: EntradaBase[]): RegistroDados {
  const entradasPrazo = EntradasPrazoSchema.parse(dados.entradasPrazo ?? {});
  const base: RegistroDados = { ...dados, entradasPrazo };
  return {
    ...base,
    verificacoes: verificarPrazos(base, entradasPrazo),
    precedentes: verificarResultado(base, { baseCustom: baseCompartilhada, anteriores: dados.precedentes }),
  };
}

const autorDe = (req: Request): Autor => ({ id: req.usuario!.id, nome: req.usuario!.nome });
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function criarRotasCasos(store: Store) {
  let cacheBase: { itens: EntradaBase[]; ate: number } | null = null;
  const baseCompartilhada = async () => {
    if (cacheBase && cacheBase.ate > Date.now()) return cacheBase.itens;
    const itens = await store.base.listar();
    cacheBase = { itens, ate: Date.now() + 15_000 };
    return itens;
  };
  const invalidarBase = () => (cacheBase = null);

  const validar = <S extends typeof RegistroNovoSchema | typeof RegistroAtualizacaoSchema>(corpo: unknown, esquema: S, res: Response): z.infer<S> | null => {
    if (JSON.stringify(corpo ?? {}).length > MAX_BYTES_REGISTRO * 1.2) {
      res.status(413).json({ error: 'Registro grande demais.' });
      return null;
    }
    // campos derivados enviados pelo cliente são ignorados: o servidor os recalcula
    const bruto = structuredClone(corpo ?? {}) as { dados?: { verificacoes?: unknown } };
    if (bruto.dados && typeof bruto.dados === 'object') delete bruto.dados.verificacoes;
    const p = esquema.safeParse(bruto);
    if (!p.success) {
      res.status(400).json({ error: `Dados inválidos: ${p.error.issues[0]?.path.join('.') || 'raiz'}: ${p.error.issues[0]?.message}` });
      return null;
    }
    const cnj = validarCNJ((p.data as { dados: RegistroDados }).dados.processo.numero);
    if (!cnj.valido) {
      res.status(400).json({ error: cnj.motivo, codigo: 'numero_invalido' });
      return null;
    }
    return p.data as z.infer<S>;
  };

  const casos = Router();

  casos.get('/', async (req, res) => {
    const busca = String(req.query.busca ?? '').trim().toLowerCase();
    const todos = await store.casos.listar(500);
    const dig = busca.replace(/\D/g, '');
    const lista = busca
      ? todos.filter((c) => (dig.length >= 4 && c.numeroProcesso.replace(/\D/g, '').includes(dig)) || c.materia.toLowerCase().includes(busca) || c.atualizadoPor.nome.toLowerCase().includes(busca))
      : todos;
    res.json({ casos: lista.slice(0, 200) });
  });

  casos.post('/', async (req, res) => {
    const corpo = validar(req.body, RegistroNovoSchema, res);
    if (!corpo) return;
    const dados = canonizar(corpo.dados, await baseCompartilhada());
    if (JSON.stringify(dados).length > MAX_BYTES_REGISTRO) return res.status(413).json({ error: 'Registro grande demais.' });
    const agora = new Date().toISOString();
    const autor = autorDe(req);
    const caso: Caso = {
      id: crypto.randomUUID(),
      numeroProcesso: dados.processo.numero,
      materia: dados.processo.materia,
      status: corpo.status ?? 'em_analise',
      versao: 1,
      criadoPor: autor,
      criadoEm: agora,
      atualizadoPor: autor,
      atualizadoEm: agora,
      dados,
    };
    const r = await store.casos.criar(caso);
    if (!r.ok) {
      return res.status(409).json({ error: 'Já existe um registro para este número de processo.', codigo: 'numero_duplicado', existente: r.existente });
    }
    res.status(201).json({ caso: r.caso });
  });

  casos.get('/:id', async (req, res) => {
    const c = await store.casos.obter(req.params.id);
    if (!c) return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json({ caso: c });
  });

  casos.put('/:id', async (req, res) => {
    const corpo = validar(req.body, RegistroAtualizacaoSchema, res);
    if (!corpo) return;
    const base = await baseCompartilhada();
    const dados = canonizar(corpo.dados, base);
    if (JSON.stringify(dados).length > MAX_BYTES_REGISTRO) return res.status(413).json({ error: 'Registro grande demais.' });
    const autor = autorDe(req);

    const r = await store.casos.atualizar(req.params.id, corpo.baseVersao, (atual) => {
      const status = corpo.status ?? atual.status;
      if (igual(dados, atual.dados) && status === atual.status) return null; // nada mudou: não gera versão
      const resumo = resumirAlteracoes(atual.dados, dados);
      if (status !== atual.status) resumo.push(`Status: ${atual.status} → ${status}`);
      return {
        resumo: resumo.length ? resumo : ['Dados recalculados'],
        caso: { ...atual, numeroProcesso: dados.processo.numero, materia: dados.processo.materia, status, versao: atual.versao + 1, atualizadoPor: autor, atualizadoEm: new Date().toISOString(), dados },
      };
    });
    if (r.ok) return res.json({ caso: r.caso });
    if (r.motivo === 'nao_encontrado') return res.status(404).json({ error: 'Registro não encontrado.' });
    if (r.motivo === 'numero_duplicado') return res.status(409).json({ error: 'Já existe outro registro com este número de processo.', codigo: 'numero_duplicado', existente: r.existente });
    return res.status(409).json({ error: 'Outro usuário alterou este registro.', codigo: 'conflito', atual: r.atual });
  });

  casos.delete('/:id', async (req, res) => {
    const c = await store.casos.obter(req.params.id);
    if (!c) return res.status(404).json({ error: 'Registro não encontrado.' });
    if (req.usuario!.papel !== 'admin' && c.criadoPor.id !== req.usuario!.id) {
      return res.status(403).json({ error: 'Apenas o autor do registro ou um administrador pode excluí-lo.' });
    }
    await store.casos.excluir(req.params.id);
    res.json({ ok: true });
  });

  casos.get('/:id/historico', async (req, res) => res.json({ historico: await store.casos.historico(req.params.id) }));

  casos.get('/:id/historico/:versao', async (req, res) => {
    const d = await store.casos.versao(req.params.id, Number(req.params.versao));
    if (!d) return res.status(404).json({ error: 'Versão não encontrada.' });
    res.json({ dados: d });
  });

  // --- base compartilhada de súmulas/temas -------------------------------------------------------------
  const base = Router();
  const EntradaSchema = z.object({
    tipo: z.enum(['sumula', 'sumula_vinculante', 'tema']),
    tribunal: z.enum(['STJ', 'STF']),
    numero: z.string().regex(/^\d{1,4}$/),
    enunciado: z.string().trim().min(5).max(4000),
    situacao: z.enum(['vigente', 'cancelada', 'superada']),
    palavrasChave: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  });

  base.get('/', async (_req, res) => res.json({ entradas: await store.base.listar() }));

  base.post('/', async (req, res) => {
    const p = z.object({ entradas: z.array(EntradaSchema).min(1).max(500) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Entrada inválida: ' + (p.error.issues[0]?.message ?? '') });
    const autor = autorDe(req);
    const agora = new Date().toISOString();
    for (const e of p.data.entradas) {
      await store.base.salvar({ ...e, tribunal: e.tipo === 'sumula_vinculante' ? 'STF' : e.tribunal, fonte: 'usuario', atualizadoPor: autor, atualizadoEm: agora });
    }
    invalidarBase();
    res.json({ entradas: await store.base.listar() });
  });

  base.delete('/', async (req, res) => {
    if (req.usuario!.papel !== 'admin') return res.status(403).json({ error: 'Apenas administradores removem entradas da base.' });
    const p = z.object({ tipo: z.enum(['sumula', 'sumula_vinculante', 'tema']), tribunal: z.enum(['STJ', 'STF']), numero: z.string() }).safeParse(req.query);
    if (!p.success) return res.status(400).json({ error: 'Parâmetros inválidos.' });
    await store.base.excluir(chaveBase(p.data));
    invalidarBase();
    res.json({ entradas: await store.base.listar() });
  });

  return { casos, base };
}
