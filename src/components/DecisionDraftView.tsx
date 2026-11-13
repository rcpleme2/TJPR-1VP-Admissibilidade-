import React, { useState } from 'react';
import { Check, Copy, Download, FileDown, Pencil } from 'lucide-react';
import { MinutaDecisao1VP } from '../types/admissibility';
import { Botao } from './ui';
import { cabecalhoSemTimbre } from '../../shared/minuta';

interface DecisionDraftViewProps {
  minuta: MinutaDecisao1VP;
  onChange: (m: MinutaDecisao1VP) => void;
  onDownloadPDF: () => void;
  onDownloadWord: () => void;
}

const Texto: React.FC<{
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  className: string;
  label: string;
  rows?: number;
}> = ({ editing, value, onChange, className, label, rows = 6 }) =>
  editing ? (
    <textarea
      aria-label={label}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="-mx-3 block w-[calc(100%+1.5rem)] resize-y rounded-md border border-linha-forte bg-toga-claro/40 px-3 py-2 font-serif text-[15px] leading-[1.7] text-tinta focus:border-toga focus:bg-folha focus:outline-none"
    />
  ) : (
    <p className={className}>{value}</p>
  );

const Titulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mb-3 text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-tinta">{children}</h3>
);

export const DecisionDraftView: React.FC<DecisionDraftViewProps> = ({ minuta, onChange, onDownloadPDF, onDownloadWord }) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const set = (parcial: Partial<MinutaDecisao1VP>) => onChange({ ...minuta, ...parcial });
  const setCap = (i: number, parcial: Partial<MinutaDecisao1VP['capitulosFundamentacao'][number]>) =>
    set({ capitulosFundamentacao: minuta.capitulosFundamentacao.map((c, k) => (k === i ? { ...c, ...parcial } : c)) });

  const getFullDecisionText = () => {
    let full = `${minuta.cabecalho}\n\n`;
    full += `I. RELATÓRIO\n${minuta.relatorio}\n\n`;
    full += `II. FUNDAMENTAÇÃO\n`;
    minuta.capitulosFundamentacao.forEach((cap) => {
      full += `\n${cap.tituloCapitulo}\n${cap.conteudo}\n`;
    });
    full += `\nIII. DISPOSITIVO\n${minuta.dispositivoFinal}\n\n`;
    return full;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFullDecisionText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const corpo = 'whitespace-pre-line text-justify font-serif text-[15px] leading-[1.75] text-tinta [hyphens:auto]';

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-[50rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-tinta-3">{editing ? 'Editando. As alterações são gravadas e seguem para o PDF e o Word.' : 'Texto pronto para revisão.'}</p>
        <div className="flex flex-wrap gap-1.5">
          <Botao tamanho="sm" variante={editing ? 'primario' : 'secundario'} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            {editing ? <Check className="size-4" /> : <Pencil className="size-3.5" />}
            {editing ? 'Concluir edição' : 'Editar'}
          </Botao>
          <Botao tamanho="sm" variante="discreto" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Botao>
          <Botao tamanho="sm" variante="discreto" onClick={onDownloadWord}>
            <FileDown className="size-4" /> Word
          </Botao>
          <Botao tamanho="sm" variante="discreto" onClick={onDownloadPDF}>
            <Download className="size-4" /> PDF
          </Botao>
        </div>
      </div>

      <article className="mx-auto max-w-[50rem] rounded-sm bg-folha px-6 py-12 shadow-[0_1px_2px_rgba(24,32,44,0.06),0_12px_32px_-16px_rgba(24,32,44,0.18)] sm:px-16 sm:py-16">
        <header className="text-center">
          <p className="font-serif text-[13px] uppercase tracking-[0.14em] text-tinta-2">Tribunal de Justiça do Estado do Paraná</p>
          <p className="mt-1 font-serif text-[17px] font-semibold text-tinta">1ª Vice-Presidência</p>
        </header>

        <div className="mt-10 border-y border-linha py-4">
          <Texto editing={editing} label="Cabeçalho" rows={4} value={editing ? minuta.cabecalho : cabecalhoSemTimbre(minuta.cabecalho)} onChange={(v) => set({ cabecalho: v })} className="whitespace-pre-line font-serif text-[14px] leading-relaxed text-tinta-2" />
        </div>

        <section className="mt-10">
          <Titulo>I. Relatório</Titulo>
          <Texto editing={editing} label="Relatório" rows={10} value={minuta.relatorio} onChange={(v) => set({ relatorio: v })} className={corpo} />
        </section>

        <section className="mt-10">
          <Titulo>II. Fundamentação</Titulo>
          <div className="space-y-8">
            {minuta.capitulosFundamentacao.map((cap, idx) => (
              <div key={idx}>
                <h4 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-serif text-[15px] font-semibold text-tinta">{cap.tituloCapitulo}</span>
                  {cap.incisoArt1030 && <span className="text-[12px] text-tinta-3">{cap.incisoArt1030}</span>}
                </h4>
                <Texto editing={editing} label={`Conteúdo do capítulo ${idx + 1}`} rows={10} value={cap.conteudo} onChange={(v) => setCap(idx, { conteudo: v })} className={corpo} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <Titulo>III. Dispositivo</Titulo>
          <Texto editing={editing} label="Dispositivo" rows={8} value={minuta.dispositivoFinal} onChange={(v) => set({ dispositivoFinal: v })} className={`${corpo} font-medium`} />
        </section>


        <footer className="mt-20 text-center">
          <div className="mx-auto h-px w-64 bg-tinta-3/50" />
          <p className="mt-2 font-serif text-[14px] text-tinta">Desembargador 1º Vice-Presidente</p>
          <p className="mt-0.5 text-[12px] text-tinta-3">Competência delegada pela Presidência (RITJPR, art. 15, § 3º)</p>
        </footer>
      </article>
    </div>
  );
};
