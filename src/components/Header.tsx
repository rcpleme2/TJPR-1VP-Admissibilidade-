import React from 'react';
import { BookOpen, ExternalLink, LogOut, PanelRight, Search, Settings } from 'lucide-react';
import { abrirEmJanela, origemDaExtensao, URL_EXTENSAO, useModoExtensao, VERSAO_EXTENSAO } from '../lib/extensao';

/** Dentro do painel da extensão, o link para baixá-la não faz sentido. */
const dentroDaExtensao = typeof window !== 'undefined' && Boolean(origemDaExtensao());

interface HeaderProps {
  onOpenGuide: () => void;
  onOpenConsulta: () => void;
  onOpenConfig: () => void;
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

const link = 'inline-flex h-9 items-center gap-2 rounded-md px-2 sm:px-2.5 text-sm text-tinta-2 transition-colors hover:bg-tinta/[0.05] hover:text-tinta';

/** No painel lateral da extensão: botão para passar o sistema para uma janela própria. */
const BotaoJanela: React.FC = () =>
  useModoExtensao() === 'painel' ? (
    <button type="button" onClick={abrirEmJanela} className={link} aria-label="Abrir em janela separada" title="Abrir em janela separada (o painel lateral fecha)">
      <ExternalLink className="size-4" />
    </button>
  ) : null;

export const Header: React.FC<HeaderProps> = ({ onOpenGuide, onOpenConsulta, onOpenConfig, onHome, usuarioNome, onConta, onLogout }) => (
  <header className="border-b border-linha bg-folha">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
      <button type="button" onClick={onHome} className="flex min-w-0 items-baseline gap-3 text-left" title="Voltar ao início">
        <span className="truncate font-serif text-[19px] font-semibold tracking-[-0.01em] text-toga sm:text-[21px]">Admissibilidade</span>
        <span className="hidden truncate text-[13px] text-tinta-3 md:inline">1ª Vice-Presidência do TJPR</span>
      </button>

      <nav className="flex shrink-0 items-center gap-0.5" aria-label="Principal">
        <button type="button" onClick={onOpenGuide} className={link} aria-label="Orientações técnicas">
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Orientações</span>
        </button>
        <button type="button" onClick={onOpenConsulta} className={link} aria-label="Consultar súmulas">
          <Search className="size-4" />
          <span className="hidden sm:inline">Súmulas</span>
        </button>
        {!dentroDaExtensao && (
        <a href={URL_EXTENSAO} download className={link} aria-label="Baixar a extensão do Chrome" title={`Baixar a extensão do Chrome${VERSAO_EXTENSAO ? `, versão ${VERSAO_EXTENSAO}` : ''}`}>
          <PanelRight className="size-4" />
          <span className="hidden sm:inline">Extensão</span>
        </a>
        )}
        <BotaoJanela />
        <button type="button" onClick={onOpenConfig} className={link} aria-label="Configurações" title="Configurações">
          <Settings className="size-4" />
        </button>

        {usuarioNome && (
          <div className="ml-1 flex items-center gap-0.5 border-l border-linha pl-2 sm:ml-2 sm:pl-3">
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
