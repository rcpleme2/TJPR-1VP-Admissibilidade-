import type { EntradaBase } from './precedentesBase';
import { chaveBase, linkOficial, montarBase, rotulo, verificarUma } from './precedentes';
import type { CitacaoPrecedente } from './schema';

export type FiltroTribunal = 'todos' | 'STJ' | 'STF';
export type FiltroTipo = 'todos' | 'sumula' | 'sumula_vinculante' | 'tema';

export interface ResultadoConsulta {
  entrada: EntradaBase;
  rotulo: string;
  link: string;
  noUsuario: boolean;
}

export interface NaoEncontrado {
  tipo: EntradaBase['tipo'];
  tribunal: 'STJ' | 'STF' | null;
  numero: string;
  rotulo: string;
  link: string;
  verificacao: CitacaoPrecedente['verificacao'];
}

export interface RespostaConsulta {
  resultados: ResultadoConsulta[];
  naoEncontrados: NaoEncontrado[];
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Consulta determinística (sem IA) na base local de súmulas, súmulas vinculantes e temas.
 * Aceita número ("7"), citação ("súmula 7 stj", "SV 10", "tema 466/STF") ou palavras do enunciado.
 */
export function consultarBase(
  consulta: string,
  custom: EntradaBase[] = [],
  filtros: { tribunal?: FiltroTribunal; tipo?: FiltroTipo } = {},
): RespostaConsulta {
  const base = [...montarBase(custom).values()];
  const q = sem(consulta).trim();
  const tribunalQ = /\bstj\b/.test(q) ? 'STJ' : /\bstf\b/.test(q) ? 'STF' : null;
  const tipoQ: EntradaBase['tipo'] | null = /\b(sv|vinculante|vinculantes)\b/.test(q) ? 'sumula_vinculante' : /\btemas?\b/.test(q) ? 'tema' : /\bsumulas?\b/.test(q) ? 'sumula' : null;

  const resto = q
    .replace(/\b(stj|stf|sv|sumulas?|vinculantes?|temas?|n|no|nº)\b/g, ' ')
    .replace(/[\/,.;]/g, ' ')
    .trim();
  const palavras = resto.split(/\s+/).filter(Boolean);
  const soNumeros = palavras.length > 0 && palavras.every((p) => /^\d{1,4}$/.test(p));

  const trib = filtros.tribunal && filtros.tribunal !== 'todos' ? filtros.tribunal : tribunalQ;
  const tipoF = filtros.tipo && filtros.tipo !== 'todos' ? filtros.tipo : tipoQ;

  let achados = base.filter((e) => (!trib || e.tribunal === trib) && (!tipoF || e.tipo === tipoF));
  const naoEncontrados: NaoEncontrado[] = [];

  if (soNumeros) {
    const nums = new Set(palavras);
    achados = achados.filter((e) => nums.has(e.numero));
    for (const n of nums) {
      for (const [t, tp] of ([['STJ', tipoF ?? 'sumula'], ['STF', tipoF ?? 'sumula']] as const)) {
        if (trib && t !== trib) continue;
        if (tp === 'sumula_vinculante' && t === 'STJ') continue;
        if (!achados.some((e) => e.numero === n && e.tribunal === t && e.tipo === tp)) {
          if (!trib && !tipoF && base.some((e) => e.numero === n)) continue; // número já aparece em outro tribunal
          naoEncontrados.push({
            tipo: tp,
            tribunal: t,
            numero: n,
            rotulo: rotulo(tp, t, n),
            link: linkOficial(tp, t, n),
            verificacao: verificarUma({ tipo: tp, tribunal: t, numero: n, contexto: '' }, montarBase(custom)),
          });
        }
      }
    }
  } else if (palavras.length > 0) {
    achados = achados.filter((e) => {
      const alvo = sem(`${e.enunciado} ${e.palavrasChave.join(' ')} ${rotulo(e.tipo, e.tribunal, e.numero)}`);
      return palavras.every((p) => alvo.includes(p));
    });
  }

  const ord = (e: EntradaBase) => (e.tribunal === 'STJ' ? 0 : 1) * 10000 + (e.tipo === 'sumula_vinculante' ? 5000 : 0) + Number(e.numero);
  achados.sort((a, b) => ord(a) - ord(b));
  const ids = new Set(custom.map(chaveBase));
  return {
    resultados: achados.map((e) => ({ entrada: e, rotulo: rotulo(e.tipo, e.tribunal, e.numero), link: linkOficial(e.tipo, e.tribunal, e.numero), noUsuario: ids.has(chaveBase(e)) })),
    naoEncontrados,
  };
}
