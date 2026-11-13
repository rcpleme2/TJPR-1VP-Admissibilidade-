import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { IS_PROD } from './config';
import type { Papel, Store, Usuario, UsuarioPublico } from './store/types';

const scrypt = promisify(crypto.scrypt) as (senha: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSAO_HORAS = 12;
const COOKIE = 'sid';

// --- senhas -------------------------------------------------------------------------------------------

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(senha, salt, 64);
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, salt, h] = armazenado.split('$');
  if (alg !== 'scrypt' || !salt || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const calc = await scrypt(senha, Buffer.from(salt, 'base64'), esperado.length);
  return crypto.timingSafeEqual(calc, esperado);
}

export const SenhaSchema = z.string().min(10, 'A senha deve ter ao menos 10 caracteres.').max(200);

// --- sessão (token assinado em cookie HttpOnly) ----------------------------------------------------------

function segredo(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (IS_PROD) throw new Error('SESSION_SECRET (mínimo 32 caracteres) é obrigatório em produção.');
  return (segredoEfemero ??= crypto.randomBytes(32).toString('hex'));
}
let segredoEfemero: string | undefined;

const assinar = (corpo: string) => crypto.createHmac('sha256', segredo()).update(corpo).digest('base64url');

export function criarSessao(uid: string, agora = Date.now()): string {
  const corpo = `${uid}.${Math.floor(agora / 1000) + SESSAO_HORAS * 3600}`;
  return `${corpo}.${assinar(corpo)}`;
}

export function lerSessao(token: string | undefined, agora = Date.now()): { uid: string } | null {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [uid, exp, sig] = partes;
  const esperado = assinar(`${uid}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) * 1000 < agora) return null;
  return { uid };
}

const lerCookie = (req: Request, nome: string) =>
  req.headers.cookie
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === nome)?.[1];

const opcoesCookie = () => `Path=/; HttpOnly; SameSite=Strict${IS_PROD ? '; Secure' : ''}`;
const definirCookie = (res: Response, token: string) => res.append('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSAO_HORAS * 3600}; ${opcoesCookie()}`);
const limparCookie = (res: Response) => res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; ${opcoesCookie()}`);

// --- usuários ---------------------------------------------------------------------------------------

export const publico = ({ senhaHash: _s, ...u }: Usuario): UsuarioPublico => u;
const normalizaEmail = (e: string) => e.trim().toLowerCase();

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: Usuario;
  }
}

/** Cria o primeiro administrador (ADMIN_EMAIL/ADMIN_PASSWORD) quando ainda não há usuários. */
export async function semearAdmin(store: Store, log: (m: Record<string, unknown>) => void = () => {}) {
  if ((await store.usuarios.contar()) > 0) return;
  let email = process.env.ADMIN_EMAIL;
  let senha = process.env.ADMIN_PASSWORD;
  let gerada = false;
  if (!email || !senha) {
    if (IS_PROD) {
      log({ severity: 'ERROR', evento: 'sem_usuarios', mensagem: 'Nenhum usuário cadastrado: defina ADMIN_EMAIL e ADMIN_PASSWORD.' });
      return;
    }
    email = 'admin@local.test';
    senha = crypto.randomBytes(9).toString('base64url');
    gerada = true;
  }
  const agora = new Date().toISOString();
  await store.usuarios.criar({
    id: crypto.randomUUID(),
    email: normalizaEmail(email),
    nome: process.env.ADMIN_NOME || 'Administrador',
    papel: 'admin',
    ativo: true,
    senhaHash: await hashSenha(senha),
    criadoEm: agora,
    atualizadoEm: agora,
  });
  log({ severity: 'NOTICE', evento: 'admin_criado', email: normalizaEmail(email) });
  if (gerada) console.log(`\n>>> Administrador de desenvolvimento criado: ${email}  senha: ${senha}\n`);
}

export function criarAuth(store: Store) {
  const cache = new Map<string, { u: Usuario | null; ate: number }>();
  const carregar = async (uid: string) => {
    const c = cache.get(uid);
    if (c && c.ate > Date.now()) return c.u;
    const u = await store.usuarios.porId(uid);
    cache.set(uid, { u, ate: Date.now() + 30_000 });
    return u;
  };
  const invalidar = (uid: string) => cache.delete(uid);

  /** Exige sessão válida de usuário ativo. */
  const autenticar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const s = lerSessao(lerCookie(req, COOKIE));
      const u = s ? await carregar(s.uid) : null;
      if (!u || !u.ativo) return res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.', codigo: 'nao_autenticado' });
      req.usuario = u;
      next();
    } catch (e) {
      next(e);
    }
  };

  const exigirAdmin = (req: Request, res: Response, next: NextFunction) =>
    req.usuario?.papel === 'admin' ? next() : res.status(403).json({ error: 'Apenas administradores podem fazer isto.' });

  const auth = Router();
  const limiteLogin = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas de login. Aguarde alguns minutos.' } });
  const DUMMY = hashSenha('senha-fictícia-para-igualar-o-tempo');

  auth.post('/login', limiteLogin, async (req, res) => {
    const p = z.object({ email: z.string().email().max(200), senha: z.string().min(1).max(200) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Informe e-mail e senha.' });
    const u = await store.usuarios.porEmail(normalizaEmail(p.data.email));
    const ok = await verificarSenha(p.data.senha, u ? u.senhaHash : await DUMMY);
    if (!u || !ok || !u.ativo) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    definirCookie(res, criarSessao(u.id));
    res.json({ usuario: publico(u) });
  });

  auth.post('/logout', (_req, res) => {
    limparCookie(res);
    res.json({ ok: true });
  });

  auth.get('/me', autenticar, (req, res) => res.json({ usuario: publico(req.usuario!) }));

  auth.post('/senha', autenticar, async (req, res) => {
    const p = z.object({ atual: z.string().min(1), nova: SenhaSchema }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' });
    if (!(await verificarSenha(p.data.atual, req.usuario!.senhaHash))) return res.status(400).json({ error: 'A senha atual não confere.' });
    await store.usuarios.atualizar(req.usuario!.id, { senhaHash: await hashSenha(p.data.nova) });
    invalidar(req.usuario!.id);
    res.json({ ok: true });
  });

  const usuarios = Router();
  usuarios.use(autenticar, exigirAdmin);

  usuarios.get('/', async (_req, res) => res.json({ usuarios: (await store.usuarios.listar()).map(publico) }));

  usuarios.post('/', async (req, res) => {
    const p = z
      .object({ email: z.string().email().max(200), nome: z.string().trim().min(2).max(120), senha: SenhaSchema, papel: z.enum(['admin', 'assessor']).default('assessor') })
      .safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' });
    const agora = new Date().toISOString();
    const u: Usuario = {
      id: crypto.randomUUID(),
      email: normalizaEmail(p.data.email),
      nome: p.data.nome,
      papel: p.data.papel as Papel,
      ativo: true,
      senhaHash: await hashSenha(p.data.senha),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    const r = await store.usuarios.criar(u);
    if (!r.ok) return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
    res.status(201).json({ usuario: publico(u) });
  });

  usuarios.patch('/:id', async (req, res) => {
    const p = z
      .object({ nome: z.string().trim().min(2).max(120).optional(), papel: z.enum(['admin', 'assessor']).optional(), ativo: z.boolean().optional(), senha: SenhaSchema.optional() })
      .safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? 'Dados inválidos.' });
    if (req.params.id === req.usuario!.id && (p.data.papel || p.data.ativo === false)) {
      return res.status(400).json({ error: 'Você não pode alterar o próprio papel nem desativar a própria conta.' });
    }
    const { senha, ...resto } = p.data;
    const novo = await store.usuarios.atualizar(req.params.id, { ...resto, ...(senha ? { senhaHash: await hashSenha(senha) } : {}) });
    if (!novo) return res.status(404).json({ error: 'Usuário não encontrado.' });
    invalidar(req.params.id);
    res.json({ usuario: publico(novo) });
  });

  /** Proteção CSRF para escritas: exige cabeçalho personalizado (não enviável por formulário de outro site). */
  const exigirAjax = (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.header('x-requested-with') !== 'fetch') return res.status(400).json({ error: 'Requisição não permitida.' });
    next();
  };

  return { autenticar, exigirAdmin, exigirAjax, auth, usuarios };
}
