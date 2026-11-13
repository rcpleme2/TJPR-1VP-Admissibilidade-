import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

/* Primitivos visuais compartilhados. Uma só cor de ação (toga); status só em texto e marcador. */

type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-toga text-white hover:bg-toga-escuro',
  secundario: 'bg-folha text-tinta border border-linha-forte hover:border-tinta-3',
  discreto: 'text-tinta-2 hover:text-tinta hover:bg-tinta/[0.05]',
  perigo: 'text-obice hover:bg-obice-fundo',
};

export const botao = (variante: Variante = 'secundario', tamanho: 'sm' | 'md' = 'md') =>
  `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
    tamanho === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm'
  } ${VARIANTES[variante]}`;

type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'sm' | 'md' };

export const Botao: React.FC<BotaoProps> = ({ variante, tamanho, className = '', type = 'button', ...p }) => (
  <button type={type} className={`${botao(variante, tamanho)} ${className}`} {...p} />
);

const BASE_CAMPO =
  'w-full rounded-md border border-linha-forte bg-folha text-sm text-tinta placeholder:text-tinta-3/80 transition-colors focus:border-toga focus:ring-2 focus:ring-toga/15 focus:outline-none disabled:bg-papel disabled:text-tinta-3';

export const campo = `${BASE_CAMPO} h-9 px-3`;
export const campoArea = `${BASE_CAMPO} px-3 py-2 leading-relaxed`;
export const campoSelect = `${BASE_CAMPO} h-9 pl-2.5 pr-8`;

export const Rotulo: React.FC<{ htmlFor?: string; children: React.ReactNode; dica?: string }> = ({ htmlFor, children, dica }) => (
  <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-tinta-2">
    <span>{children}</span>
    {dica && <span className="font-normal text-tinta-3">{dica}</span>}
  </label>
);

export const Ajuda: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`mt-1.5 text-[13px] leading-snug text-tinta-3 ${className}`}>{children}</p>
);

export type Tom = 'ok' | 'atencao' | 'obice' | 'neutro';
const COR_TOM: Record<Tom, string> = { ok: 'text-ok', atencao: 'text-atencao', obice: 'text-obice', neutro: 'text-tinta-3' };

/** Status: marcador quadrado + texto na cor do tom, sem caixa. */
export const Marca: React.FC<{ tom: Tom; children: React.ReactNode; className?: string }> = ({ tom, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${COR_TOM[tom]} ${className}`}>
    <span aria-hidden className="size-[7px] shrink-0 rounded-[2px] bg-current" />
    {children}
  </span>
);

/** Aviso de linha: régua lateral, sem caixa colorida. */
export const Nota: React.FC<{ tom?: Tom; children: React.ReactNode; className?: string; role?: string }> = ({ tom = 'neutro', children, className = '', role }) => {
  const regua = { ok: 'border-ok', atencao: 'border-atencao', obice: 'border-obice', neutro: 'border-linha-forte' }[tom];
  return (
    <div role={role} className={`border-l-2 ${regua} pl-3.5 text-sm text-tinta-2 ${className}`}>
      {children}
    </div>
  );
};

export const Folha: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }> = ({ as: Tag = 'section', className = '', ...p }) => (
  <Tag className={`rounded-lg border border-linha bg-folha ${className}`} {...p} />
);

export const TituloSecao: React.FC<{ children: React.ReactNode; id?: string; className?: string; as?: 'h2' | 'h3' }> = ({ children, id, className = '', as: Tag = 'h2' }) => (
  <Tag id={id} className={`font-serif text-[19px] font-semibold leading-tight tracking-[-0.005em] text-tinta ${className}`}>
    {children}
  </Tag>
);

/** Abas sublinhadas, usadas no resultado, no checklist e no guia. */
export function Abas<T extends string>({
  itens,
  ativa,
  onChange,
  rotulo,
  className = '',
}: {
  itens: Array<{ id: T; rotulo: React.ReactNode; contagem?: number; alerta?: boolean }>;
  ativa: T;
  onChange: (id: T) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={`flex gap-6 overflow-x-auto ${className}`}>
      {itens.map((a) => (
        <button
          key={a.id}
          role="tab"
          type="button"
          aria-selected={ativa === a.id}
          onClick={() => onChange(a.id)}
          className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 py-3 text-sm transition-colors ${
            ativa === a.id ? 'border-toga font-medium text-tinta' : 'border-transparent text-tinta-3 hover:text-tinta'
          }`}
        >
          {a.rotulo}
          {a.contagem !== undefined && (
            <span className={`num text-[13px] ${a.alerta ? 'font-semibold text-obice' : 'text-tinta-3'}`}>{a.contagem}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export const Modal: React.FC<{
  titulo: string;
  subtitulo?: React.ReactNode;
  onClose: () => void;
  largura?: string;
  rodape?: React.ReactNode;
  cabecalhoExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ titulo, subtitulo, onClose, largura = 'max-w-lg', rodape, cabecalhoExtra, children }) => {
  const id = useId();
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/35 p-4 sm:items-center"
    >
      <div className={`my-auto flex max-h-[90vh] w-full ${largura} flex-col rounded-xl bg-folha shadow-[0_24px_64px_-24px_rgba(24,32,44,0.45)]`}>
        <header className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            <h2 id={id} className="font-serif text-[22px] font-semibold leading-tight text-tinta">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-1 text-[13px] text-tinta-3">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 rounded-md p-1.5 text-tinta-3 hover:bg-papel hover:text-tinta">
            <X className="size-5" />
          </button>
        </header>
        {cabecalhoExtra && <div className="border-b border-linha px-6">{cabecalhoExtra}</div>}
        <div className={`overflow-y-auto px-6 pb-6 ${cabecalhoExtra ? 'pt-5' : 'pt-4'}`}>{children}</div>
        {rodape && <footer className="flex justify-end gap-2 border-t border-linha px-6 py-4">{rodape}</footer>}
      </div>
    </div>
  );
};

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
