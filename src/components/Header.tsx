import React from 'react';
import { BookOpen, LogOut, Search } from 'lucide-react';

interface HeaderProps {
  onOpenGuide: () => void;
  onOpenConsulta: () => void;
  onHome: () => void;
  usuarioNome?: string;
  onConta?: () => void;
  onLogout?: () => void;
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const link = 'inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-tinta-2 transition-colors hover:bg-tinta/[0.05] hover:text-tinta';

export const Header: React.FC<HeaderProps> = ({ onOpenGuide, onOpenConsulta, onHome, usuarioNome, onConta, onLogout }) => (
  <header className="border-b border-linha bg-folha">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
      <button type="button" onClick={onHome} className="flex min-w-0 items-baseline gap-3 text-left" title="Voltar ao início">
        <span className="font-serif text-[21px] font-semibold tracking-[-0.01em] text-toga">Admissibilidade</span>
        <span className="hidden truncate text-[13px] text-tinta-3 md:inline">1ª Vice-Presidência do TJPR</span>
      </button>

      <nav className="flex items-center gap-0.5" aria-label="Principal">
        <button type="button" onClick={onOpenGuide} className={link} aria-label="Orientações técnicas">
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Orientações</span>
        </button>
        <button type="button" onClick={onOpenConsulta} className={link} aria-label="Consultar súmulas">
          <Search className="size-4" />
          <span className="hidden sm:inline">Súmulas</span>
        </button>

        {usuarioNome && (
          <div className="ml-2 flex items-center gap-0.5 border-l border-linha pl-3">
            <button type="button" onClick={onConta} className={`${link} pl-1`} title="Conta e usuários">
              <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-toga-claro text-[11px] font-semibold text-toga">
                {iniciais(usuarioNome)}
              </span>
              <span className="hidden max-w-[9rem] truncate lg:inline">{usuarioNome}</span>
            </button>
            <button type="button" onClick={onLogout} aria-label="Sair" title="Sair" className={`${link} px-2`}>
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </nav>
    </div>
  </header>
);
