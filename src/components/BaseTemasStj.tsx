import React, { useState } from 'react';
import { ExternalLink, Loader2, Plus, Search } from 'lucide-react';
import type { SugestaoTemaStj } from '../../shared/schema';
import { linkTema } from '../../shared/sobrestamento';
import { ROTULO_FASE_STJ } from '../../shared/temasStj';
import { nuvem } from '../lib/nuvem';
import { Botao, campo, Marca } from './ui';

const ROTULO_SUSP: Record<SugestaoTemaStj['suspensao'], string> = {
  determinada: 'Suspensão determinada',
  nao_determinada: 'Sem ordem de suspensão',
  nao_informada: 'Suspensão não informada',
};

/** Um tema da base oficial, com questão, situação, suspensão e tese (recolhível). */
export const ItemTemaStj: React.FC<{ t: SugestaoTemaStj; incluido: boolean; onIncluir: () => void }> = ({ t, incluido, onIncluir }) => {
  const [tese, setTese] = useState(false);
  const sobrestaria = t.fase === 'pendente' && t.suspensao !== 'nao_determinada';
  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-[16px] font-semibold text-tinta">
              {t.especie === 'relevancia' ? 'Relevância' : 'Tema'} {t.numero}/STJ
            </span>
            <span className="text-[13px] text-tinta-3">{t.situacao || ROTULO_FASE_STJ[t.fase]}</span>
            <Marca tom={sobrestaria ? 'atencao' : 'neutro'}>
              {t.fase !== 'pendente' && t.suspensao === 'determinada' ? 'Houve ordem de suspensão' : ROTULO_SUSP[t.suspensao]}
            </Marca>
          </p>
          <p className="mt-1 text-sm leading-snug text-tinta-2">{t.questao}</p>
          {t.tese && (
            <button type="button" onClick={() => setTese(!tese)} aria-expanded={tese} className="mt-1 text-[13px] text-toga underline-offset-2 hover:underline">
              {tese ? 'Ocultar a tese' : 'Ver a tese firmada'}
            </button>
          )}
          {tese && t.tese && <p className="mt-1.5 border-l-2 border-linha pl-3 font-serif text-[14px] leading-relaxed text-tinta-2">{t.tese}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a href={linkTema({ tribunal: 'STJ', numero: t.numero })} target="_blank" rel="noopener noreferrer" title="Página do tema no STJ" aria-label={`Abrir o tema ${t.numero} no STJ`} className="rounded-md p-2 text-tinta-3 hover:bg-tinta/[0.05] hover:text-toga">
            <ExternalLink className="size-4" />
          </a>
          <Botao tamanho="sm" onClick={onIncluir} disabled={incluido}>
            {incluido ? 'Incluído' : (
              <>
                <Plus className="size-3.5" /> Examinar
              </>
            )}
          </Botao>
        </div>
      </div>
    </li>
  );
};

interface Props {
  sugestoes: SugestaoTemaStj[];
  baseEm?: string;
  incluidos: Set<string>;
  onIncluir: (t: SugestaoTemaStj, consultadoEm: string) => void;
}

/** Temas da base do STJ parecidos com as peças, e pesquisa por número ou por palavras. */
export const BaseTemasStj: React.FC<Props> = ({ sugestoes, baseEm, incluidos, onIncluir }) => {
  const [q, setQ] = useState('');
  const [so, setSo] = useState(false);
  const [estado, setEstado] = useState<{ carregando: boolean; erro?: string; resultado?: SugestaoTemaStj[]; em?: string }>({ carregando: false });

  const pesquisar = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = q.trim();
    if (!texto) return;
    setEstado({ carregando: true });
    try {
      const numero = /^\d[\d.]*$/.test(texto) ? texto.replace(/\D/g, '') : undefined;
      const r = await nuvem.temasStj(numero ? { numero } : { q: texto, pendentes: so });
      setEstado({ carregando: false, resultado: r.temas, em: r.atualizadaEm });
    } catch (err) {
      setEstado({ carregando: false, erro: (err as Error).message });
    }
  };

  const lista = (itens: SugestaoTemaStj[], em: string) => (
    <ul className="divide-y divide-linha">
      {itens.map((t) => (
        <ItemTemaStj key={`${t.especie}${t.numero}`} t={t} incluido={incluidos.has(t.numero)} onIncluir={() => onIncluir(t, em)} />
      ))}
    </ul>
  );

  return (
    <section aria-labelledby="stj-titulo" className="rounded-lg border border-linha bg-papel/60 px-4 py-4 sm:px-5">
      <h4 id="stj-titulo" className="text-sm font-semibold text-tinta">
        Base de temas do STJ
      </h4>
      <p className="mt-0.5 text-[13px] text-tinta-3">Dados abertos do STJ: questão submetida, situação, ordem de suspensão e tese de cada tema repetitivo e de relevância.</p>

      {sugestoes.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-medium text-tinta-2">Parecidos com as peças deste processo</p>
          {lista(sugestoes, baseEm ?? new Date().toISOString())}
        </div>
      )}

      <form onSubmit={pesquisar} className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Pesquisar na base de temas do STJ"
            placeholder="Número do tema ou palavras da questão de direito"
            className={`${campo} h-9 pl-8 text-[13px]`}
          />
        </div>
        <label className="flex items-center gap-1.5 text-[13px] text-tinta-2">
          <input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} />
          só afetados pendentes
        </label>
        <Botao type="submit" tamanho="sm" disabled={estado.carregando}>
          {estado.carregando ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          Pesquisar
        </Botao>
      </form>
      {estado.erro && <p className="mt-2 text-[13px] text-obice">{estado.erro}</p>}
      {estado.resultado && (estado.resultado.length === 0 ? <p className="mt-3 text-[13px] text-tinta-3">Nenhum tema encontrado.</p> : <div className="mt-2">{lista(estado.resultado, estado.em!)}</div>)}
      {(estado.em || baseEm) && <p className="num mt-3 text-[12px] text-tinta-3">Base do STJ atualizada em {new Date(estado.em || baseEm!).toLocaleDateString('pt-BR')} (atualiza às sextas-feiras, exceto no recesso de 20/12 a 06/01).</p>}
    </section>
  );
};
