import type { EntradaBase } from '../../shared/precedentesBase';

export function exportarBase(base: EntradaBase[]) {
  const blob = new Blob([JSON.stringify(base, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'base-precedentes-tjpr1vp.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Lê e valida um JSON de base própria. Lança Error se o formato for inválido. */
export async function importarBase(f: File): Promise<EntradaBase[]> {
  const j = JSON.parse(await f.text()) as EntradaBase[];
  const ok =
    Array.isArray(j) &&
    j.every((e) => e && ['sumula', 'sumula_vinculante', 'tema'].includes(e.tipo) && ['STJ', 'STF'].includes(e.tribunal) && typeof e.numero === 'string' && typeof e.enunciado === 'string');
  if (!ok) throw new Error('formato inválido');
  return j.map((e) => ({ ...e, palavrasChave: Array.isArray(e.palavrasChave) ? e.palavrasChave : [], situacao: e.situacao ?? 'vigente', fonte: 'usuario' as const }));
}
