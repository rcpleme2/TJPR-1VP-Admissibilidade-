import crypto from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AnalyzeRequestSchema, LIMITES, PROVEDORES, type ModelOutput } from '../shared/schema';
import { enriquecer, executarAnalise, RequisicaoInvalida } from './analyze';
import {
  chaveDoServidor,
  IS_PROD,
  MODELOS_PADRAO,
  PORT,
  provedoresComChaveNoServidor,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MIN,
} from './config';
import { criarAuth, semearAdmin } from './auth';
import { criarRotasCasos } from './casos';
import { criarStore, type Store } from './store';
import { ProviderError } from './providers/types';
import { listarModelos } from './providers/modelos';
import { INSTRUCOES_PADRAO } from './prompt';
import { redigirSegredos } from './sanitize';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Log estruturado (Cloud Logging). NUNCA registra conteúdo dos autos, chaves ou tokens. */
export function auditar(evento: Record<string, unknown>) {
  console.log(JSON.stringify({ severity: evento.ok === false ? 'WARNING' : 'INFO', ts: new Date().toISOString(), ...evento }));
}

const hashIp = (ip: string | undefined) => crypto.createHash('sha256').update(ip ?? '').digest('hex').slice(0, 12);

export function createApp(store: Store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Cloud Run encaminha o IP real via X-Forwarded-For

  app.use(
    helmet({
      contentSecurityPolicy: IS_PROD
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              // pré-visualização dos PDFs anexados (blob: gerado no próprio navegador)
              frameSrc: ["'self'", 'blob:'],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    }),
  );

  // Cloud Run limita a requisição a 32 MiB; 30 MB cobre os 22 MB de PDF em base64.
  app.use('/api', express.json({ limit: '30mb' }));

  const { autenticar, exigirAjax, auth, usuarios } = criarAuth(store);
  const rotas = criarRotasCasos(store);
  app.use('/api', exigirAjax);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/config', (_req, res) => {
    res.json({
      autenticacao: true,
      serverKeys: provedoresComChaveNoServidor(),
      provedores: PROVEDORES,
      modelosPadrao: MODELOS_PADRAO,
      limites: LIMITES,
    });
  });

  app.use('/api/auth', auth);
  app.use('/api/usuarios', usuarios);
  app.use('/api/casos', autenticar, rotas.casos);
  app.use('/api/base-precedentes', autenticar, rotas.base);

  app.get('/api/sample-case', autenticar, (_req, res) => {
    const fixture = JSON.parse(readFileSync(path.resolve(__dirname, IS_PROD ? '../server/fixtures/sample-case.json' : 'fixtures/sample-case.json'), 'utf8')) as ModelOutput;
    res.json({ success: true, data: enriquecer(fixture, { provedor: 'exemplo', modelo: 'caso-simulado', geradoEm: new Date().toISOString() }) });
  });

  const limiteModelos = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas consultas seguidas. Aguarde um minuto.' } });

  app.get('/api/instrucoes-padrao', autenticar, (_req, res) => res.json({ instrucoes: INSTRUCOES_PADRAO }));

  app.post('/api/modelos', autenticar, limiteModelos, async (req: Request, res: Response) => {
    const provider = req.body?.provider;
    if (!PROVEDORES.includes(provider)) return res.status(400).json({ error: 'Motor de IA inválido.' });
    const apiKey = req.header('x-llm-api-key')?.trim() || chaveDoServidor(provider);
    if (!apiKey) return res.status(400).json({ error: 'Informe a chave de API para consultar os modelos.' });
    if (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) return res.status(400).json({ error: 'Chave de API em formato inválido.' });
    try {
      res.json({ modelos: await listarModelos(provider, apiKey) });
    } catch (err) {
      const status = err instanceof ProviderError ? (err.status === 401 || err.status === 403 ? 400 : 502) : 500;
      res.status(status).json({ error: err instanceof ProviderError ? err.message : 'Erro ao consultar os modelos.' });
    }
  });

  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MIN * 60_000,
    limit: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Muitas análises em pouco tempo. Tente novamente em alguns minutos.` },
  });

  app.post('/api/analyze', autenticar, limiter, async (req: Request, res: Response) => {
    const inicio = Date.now();
    const parsed = AnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Requisição inválida.';
      return res.status(400).json({ error: msg });
    }
    const dados = parsed.data;

    const chaveUsuario = req.header('x-llm-api-key')?.trim();
    const apiKey = chaveUsuario || chaveDoServidor(dados.provider);
    if (!apiKey) {
      return res.status(400).json({ error: `Informe a chave de API do motor ${dados.provider.toUpperCase()} nas configurações.` });
    }
    if (apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) {
      return res.status(400).json({ error: 'Chave de API em formato inválido.' });
    }

    // Resposta em NDJSON: etapas reais de progresso + resultado final (mantém a conexão ativa).
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    const enviar = (obj: unknown) => {
      if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n');
    };

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    const meta = {
      evento: 'analise',
      provedor: dados.provider,
      modelo: dados.model ?? MODELOS_PADRAO[dados.provider],
      arquivos: dados.files.length,
      chaveDoUsuario: Boolean(chaveUsuario),
      usuario: req.usuario!.id,
      ip: hashIp(req.ip),
    };
    try {
      const r = await executarAnalise(dados, apiKey, (mensagem) => enviar({ type: 'stage', mensagem }), abort.signal);
      enviar({ type: 'result', data: r.data, securityWarnings: r.avisosSeguranca });
      auditar({ ...meta, ok: true, ms: Date.now() - inicio });
    } catch (err) {
      const msg =
        err instanceof RequisicaoInvalida || err instanceof ProviderError
          ? err.message
          : 'Erro interno ao processar a análise.';
      enviar({ type: 'error', error: redigirSegredos(msg) });
      auditar({ ...meta, ok: false, ms: Date.now() - inicio, erro: err instanceof ProviderError ? `provider_${err.status}` : (err as Error)?.name });
    } finally {
      res.end();
    }
  });

  // JSON malformado / corpo grande demais
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Arquivos grandes demais. O limite é de cerca de 22 MB de PDFs por análise.' });
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requisição malformada.' });
    next(err);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  return app;
}

async function iniciar() {
  const store = await criarStore();
  await semearAdmin(store, auditar);
  const app = createApp(store);

  if (!IS_PROD) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ severity: 'ERROR', evento: 'erro_nao_tratado', erro: (err as Error)?.name }));
    res.status(500).json({ error: 'Erro interno.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ severity: 'INFO', evento: 'inicio', porta: PORT, producao: IS_PROD, armazenamento: process.env.STORE || (IS_PROD ? 'firestore' : 'file') }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciar().catch((err) => {
    console.error('Falha ao iniciar:', err);
    process.exit(1);
  });
}
