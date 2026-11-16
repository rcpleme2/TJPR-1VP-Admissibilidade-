import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { acharMovimento, RE_CITACAO_MOV, type Movimento } from '../../shared/movimentos';

/** Movimentações do caso aberto, disponíveis para qualquer texto que cite "mov. X". */
export const MovimentosContext = createContext<Movimento[]>([]);

const intervalo = (ps: number[]) => (ps.length === 0 ? '' : ps.length === 1 ? `p. ${ps[0]}` : `p. ${ps[0]}–${ps.at(-1)}`);

/** Referência a um movimento: ao passar o mouse ou focar, abre o conteúdo numa janela flutuante. */
export const RefMov: React.FC<{ mov: Movimento; children: React.ReactNode }> = ({ mov, children }) => {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; acima: boolean } | null>(null);
  const ancora = useRef<HTMLSpanElement>(null);
  const janela = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const id = useId();

  const abrir = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAberto(true), 120);
  };
  const fechar = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAberto(false), 180);
  };

  useLayoutEffect(() => {
    if (!aberto || !ancora.current) return;
    const r = ancora.current.getBoundingClientRect();
    const largura = Math.min(448, window.innerWidth - 32);
    const altura = janela.current?.offsetHeight ?? 320;
    const acima = r.bottom + altura + 12 > window.innerHeight && r.top > altura + 12;
    setPos({ top: acima ? r.top - altura - 8 : r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - largura - 16)), acima });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    const rolar = () => setAberto(false);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', rolar, true);
    return () => {
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', rolar, true);
    };
  }, [aberto]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const detalhe = [mov.data, mov.descricao && (mov.arquivo ? `${mov.descricao} (${mov.arquivo})` : mov.descricao)].filter(Boolean).join(', ');

  return (
    <>
      <span
        ref={ancora}
        tabIndex={0}
        aria-describedby={aberto ? id : undefined}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocus={abrir}
        onBlur={fechar}
        className="cursor-help rounded-[2px] border-b border-dotted border-toga/70 text-toga outline-offset-2 hover:bg-toga-claro"
      >
        {children}
      </span>
      {aberto &&
        createPortal(
          <div
            ref={janela}
            id={id}
            role="tooltip"
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={fechar}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 'min(28rem, calc(100vw - 2rem))' }}
            className="fixed z-[60] rounded-lg border border-linha bg-folha shadow-[0_18px_44px_-18px_rgba(24,32,44,0.45)]"
          >
            <div className="border-b border-linha px-4 pb-2.5 pt-3">
              <p className="font-serif text-[15px] font-semibold text-tinta">Mov. {mov.ref}</p>
              {detalhe && <p className="num mt-0.5 text-[13px] text-tinta-2">{detalhe}</p>}
              <p className="mt-0.5 truncate text-[12px] text-tinta-3">{[intervalo(mov.paginas), mov.origem].filter(Boolean).join(', ')}</p>
            </div>
            <div className="max-h-72 overflow-y-auto px-4 py-3">
              {mov.texto.trim() ? (
                <p className="whitespace-pre-line font-serif text-[13.5px] leading-relaxed text-tinta">{mov.texto}</p>
              ) : (
                <p className="text-[13px] text-tinta-3">O conteúdo deste movimento não foi lido: o PDF é escaneado ou trouxe só a listagem da movimentação.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

/** Texto em que as citações "mov. X" / "seq. X" com movimento conhecido viram referências com janela. */
export const ComRefs: React.FC<{ texto?: string | null }> = ({ texto }) => {
  const movimentos = useContext(MovimentosContext);
  if (!texto) return null;
  if (movimentos.length === 0) return <>{texto}</>;
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(new RegExp(RE_CITACAO_MOV.source, 'gi'))) {
    const mov = acharMovimento(movimentos, m[2]!);
    if (!mov || m.index === undefined) continue;
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(
      <RefMov key={m.index} mov={mov}>
        {m[0]}
      </RefMov>,
    );
    ultimo = m.index + m[0].length;
  }
  if (partes.length === 0) return <>{texto}</>;
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
};

/** Lista das movimentações lidas dos PDFs (diagnóstico). */
export const ListaMovimentos: React.FC = () => {
  const movimentos = useContext(MovimentosContext);
  if (movimentos.length === 0) return null;
  return (
    <section aria-labelledby="movs-titulo">
      <h3 id="movs-titulo" className="flex items-baseline justify-between border-b border-linha pb-2 text-sm font-semibold text-tinta">
        Movimentações lidas <span className="num font-normal text-tinta-3">{movimentos.length}</span>
      </h3>
      <ul className="max-h-[28rem] divide-y divide-linha overflow-y-auto">
        {movimentos.map((m) => (
          <li key={m.ref} className="flex gap-3 py-2.5 text-[13px] leading-snug">
            <span className="num w-14 shrink-0">
              <RefMov mov={m}>mov. {m.ref}</RefMov>
            </span>
            <span className="min-w-0 text-tinta-2">
              {m.descricao ?? m.arquivo ?? 'Documento'}
              {m.data && <span className="num block text-tinta-3">{m.data}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
