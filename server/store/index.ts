import path from 'node:path';
import { criarStoreMemoria } from './memory';
import type { Store } from './types';

/**
 * STORE=firestore  -> Firestore (produção no Cloud Run; credenciais automáticas da conta de serviço)
 * STORE=file       -> arquivo JSON em DATA_DIR (padrão em desenvolvimento; instância única)
 * STORE=memory     -> só memória (testes)
 */
export async function criarStore(): Promise<Store> {
  const tipo = process.env.STORE || (process.env.NODE_ENV === 'production' ? 'firestore' : 'file');
  if (tipo === 'firestore') {
    const { criarStoreFirestore } = await import('./firestore');
    return criarStoreFirestore(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
  }
  if (tipo === 'memory') return criarStoreMemoria();
  return criarStoreMemoria(path.resolve(process.env.DATA_DIR || 'data', 'registros.json'));
}

export type { Store } from './types';
