import crypto from 'node:crypto';
import type { Firestore } from '@google-cloud/firestore';
import { chaveBase } from '../../shared/precedentes';
import type { Caso, CasoResumo, EntradaHistorico, RegistroDados } from '../../shared/registro';
import { MAX_HISTORICO, resumoDe, type EntradaBaseNuvem, type Store, type Usuario } from './types';

const soDigitos = (s: string) => s.replace(/\D/g, '');
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 40);
const pad = (n: number) => String(n).padStart(6, '0');

/**
 * Persistência no Firestore (modo nativo). Cada registro é um documento com os metadados indexáveis
 * e os dados extraídos serializados em `dadosJson` (campo SEM índice: ver scripts/deploy-cloudrun.sh).
 *  usuarios/{id}            emails/{email}      (trava de unicidade)
 *  casos/{id}               numeros/{digitos}   (trava: um registro por processo)
 *  casos/{id}/historico/{versão com 6 dígitos}  base/{hash da chave}
 *  arquivos/{nome} e arquivos/{nome}/partes/{6 dígitos}  (cópia da base de temas do STJ)
 */
export async function criarStoreFirestore(projectId?: string): Promise<Store> {
  const { Firestore } = await import('@google-cloud/firestore');
  const db: Firestore = new Firestore({ projectId, ignoreUndefinedProperties: true });

  const paraCaso = (d: FirebaseFirestore.DocumentData): Caso => {
    const { dadosJson, numeroNormalizado: _n, ...resto } = d;
    return { ...(resto as CasoResumo), dados: JSON.parse(dadosJson) as RegistroDados };
  };
  const paraResumo = (d: FirebaseFirestore.DocumentData): CasoResumo => {
    const { dadosJson: _j, numeroNormalizado: _n, ...resto } = d;
    return resto as CasoResumo;
  };
  const gravavel = (c: Caso) => ({ ...resumoDe(c), numeroNormalizado: soDigitos(c.numeroProcesso), dadosJson: JSON.stringify(c.dados) });
  const histDoc = (c: Caso, resumo: string[]) => ({ versao: c.versao, por: c.atualizadoPor, em: c.atualizadoEm, resumo, dadosJson: JSON.stringify(c.dados) });

  return {
    usuarios: {
      async contar() {
        const r = await db.collection('usuarios').count().get();
        return r.data().count;
      },
      async porId(id) {
        const d = await db.collection('usuarios').doc(id).get();
        return d.exists ? (d.data() as Usuario) : null;
      },
      async porEmail(email) {
        const q = await db.collection('usuarios').where('email', '==', email).limit(1).get();
        return q.empty ? null : (q.docs[0].data() as Usuario);
      },
      async listar() {
        const q = await db.collection('usuarios').get();
        return q.docs.map((d) => d.data() as Usuario).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      },
      async criar(u) {
        return db.runTransaction(async (tx) => {
          const trava = db.collection('emails').doc(hash(u.email));
          if ((await tx.get(trava)).exists) return { ok: false as const, motivo: 'email_duplicado' as const };
          tx.set(trava, { userId: u.id });
          tx.set(db.collection('usuarios').doc(u.id), u);
          return { ok: true as const };
        });
      },
      async atualizar(id, patch) {
        const ref = db.collection('usuarios').doc(id);
        return db.runTransaction(async (tx) => {
          const d = await tx.get(ref);
          if (!d.exists) return null;
          const novo = { ...(d.data() as Usuario), ...patch, atualizadoEm: new Date().toISOString() };
          tx.set(ref, novo);
          return novo;
        });
      },
    },
    casos: {
      async listar(limite) {
        const q = await db.collection('casos').orderBy('atualizadoEm', 'desc').limit(limite).get();
        return q.docs.map((d) => paraResumo(d.data()));
      },
      async obter(id) {
        const d = await db.collection('casos').doc(id).get();
        return d.exists ? paraCaso(d.data()!) : null;
      },
      async criar(caso) {
        const num = soDigitos(caso.numeroProcesso);
        return db.runTransaction(async (tx) => {
          const trava = db.collection('numeros').doc(num);
          const t = await tx.get(trava);
          if (t.exists) {
            const ex = await tx.get(db.collection('casos').doc(t.data()!.casoId));
            if (ex.exists) return { ok: false as const, motivo: 'numero_duplicado' as const, existente: paraResumo(ex.data()!) };
          }
          tx.set(trava, { casoId: caso.id });
          tx.set(db.collection('casos').doc(caso.id), gravavel(caso));
          tx.set(db.collection('casos').doc(caso.id).collection('historico').doc(pad(caso.versao)), histDoc(caso, ['Registro criado']));
          return { ok: true as const, caso };
        });
      },
      async atualizar(id, baseVersao, montar) {
        const ref = db.collection('casos').doc(id);
        return db.runTransaction(async (tx) => {
          const d = await tx.get(ref);
          if (!d.exists) return { ok: false as const, motivo: 'nao_encontrado' as const };
          const atual = paraCaso(d.data()!);
          if (atual.versao !== baseVersao) return { ok: false as const, motivo: 'conflito' as const, atual: resumoDe(atual) };
          const m = montar(atual);
          if (!m) return { ok: true as const, caso: atual };
          const velho = soDigitos(atual.numeroProcesso);
          const novo = soDigitos(m.caso.numeroProcesso);
          if (novo !== velho) {
            const trava = db.collection('numeros').doc(novo);
            const t = await tx.get(trava);
            if (t.exists && t.data()!.casoId !== id) {
              const ex = await tx.get(db.collection('casos').doc(t.data()!.casoId));
              if (ex.exists) return { ok: false as const, motivo: 'numero_duplicado' as const, existente: paraResumo(ex.data()!) };
            }
            tx.set(trava, { casoId: id });
            tx.delete(db.collection('numeros').doc(velho));
          }
          tx.set(ref, gravavel(m.caso));
          tx.set(ref.collection('historico').doc(pad(m.caso.versao)), histDoc(m.caso, m.resumo));
          if (m.caso.versao > MAX_HISTORICO) tx.delete(ref.collection('historico').doc(pad(m.caso.versao - MAX_HISTORICO)));
          return { ok: true as const, caso: m.caso };
        });
      },
      async excluir(id) {
        const ref = db.collection('casos').doc(id);
        const d = await ref.get();
        if (!d.exists) return false;
        const num = soDigitos(d.data()!.numeroProcesso ?? '');
        await db.recursiveDelete(ref);
        if (num) await db.collection('numeros').doc(num).delete();
        return true;
      },
      async historico(id) {
        const q = await db.collection('casos').doc(id).collection('historico').orderBy('versao', 'desc').limit(MAX_HISTORICO).get();
        return q.docs.map((d) => {
          const { dadosJson: _j, ...h } = d.data();
          return h as EntradaHistorico;
        });
      },
      async versao(id, versao) {
        const d = await db.collection('casos').doc(id).collection('historico').doc(pad(versao)).get();
        return d.exists ? (JSON.parse(d.data()!.dadosJson) as RegistroDados) : null;
      },
    },
    // arquivos/{nome} guarda os metadados; arquivos/{nome}/partes/{i} os bytes, em partes de até 900 KB
    // (limite de 1 MiB por documento). Tudo é gravado num único lote, para nunca misturar versões.
    arquivos: {
      async ler(nome) {
        const ref = db.collection('arquivos').doc(nome);
        const meta = await ref.get();
        if (!meta.exists) return null;
        const { em, partes } = meta.data() as { em: string; partes: number };
        const docs = await ref.collection('partes').get();
        const porId = new Map(docs.docs.map((d) => [d.id, d.data().dados as Buffer]));
        const pedacos: Buffer[] = [];
        for (let i = 0; i < partes; i++) {
          const p = porId.get(pad(i));
          if (!p) return null;
          pedacos.push(Buffer.from(p));
        }
        return { dados: Buffer.concat(pedacos), em };
      },
      async gravar(nome, dados, em) {
        const ref = db.collection('arquivos').doc(nome);
        const PARTE = 900 * 1024;
        const n = Math.max(1, Math.ceil(dados.length / PARTE));
        const existentes = await ref.collection('partes').get();
        const lote = db.batch();
        for (let i = 0; i < n; i++) lote.set(ref.collection('partes').doc(pad(i)), { dados: dados.subarray(i * PARTE, (i + 1) * PARTE) });
        existentes.docs.filter((d) => Number(d.id) >= n).forEach((d) => lote.delete(d.ref));
        lote.set(ref, { em, partes: n, tamanho: dados.length });
        await lote.commit();
      },
    },
    base: {
      async listar() {
        const q = await db.collection('base').get();
        return q.docs.map((d) => d.data() as EntradaBaseNuvem);
      },
      async salvar(e) {
        await db.collection('base').doc(hash(chaveBase(e))).set(e);
      },
      async excluir(chave) {
        await db.collection('base').doc(hash(chave)).delete();
      },
    },
  };
}
