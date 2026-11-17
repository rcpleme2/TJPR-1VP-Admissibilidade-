import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AlertaInjecao } from '../../shared/injecao';

/** Lista de trechos com instruções à IA (prompt injection), com documento, página e o trecho encontrado. */
export const AlertasInjecaoLista: React.FC<{ alertas: AlertaInjecao[]; compacto?: boolean }> = ({ alertas, compacto }) => (
  <div className={compacto ? 'mt-2 rounded-md bg-obice-fundo px-3 py-2' : ''}>
    {compacto && (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-obice">
        <ShieldAlert className="size-3.5 shrink-0" />
        Possível instrução à IA neste documento
      </p>
    )}
    <ul className={`space-y-1.5 text-[13px] text-tinta-2 ${compacto ? 'mt-1' : ''}`}>
      {alertas.map((a, i) => (
        <li key={i}>
          <span className="font-medium text-tinta">
            {!compacto && a.documento ? `${a.documento}${a.pagina ? `, p. ${a.pagina}` : ''}: ` : a.pagina ? `p. ${a.pagina}: ` : ''}
            {a.descricao}
          </span>
          {a.trecho && <q className="mt-0.5 block font-serif text-[13px] italic text-tinta-2">{a.trecho}</q>}
        </li>
      ))}
    </ul>
  </div>
);

interface AlertaModelo {
  documento: string;
  pagina?: string;
  trecho: string;
  descricao: string;
}

/** Aviso no topo do resultado: o que a varredura do sistema e a própria IA encontraram. */
export const AlertasSeguranca: React.FC<{ doSistema: AlertaInjecao[]; daIA?: AlertaModelo[] }> = ({ doSistema, daIA = [] }) => {
  const ia: AlertaInjecao[] = daIA.map((a) => ({ documento: a.documento, descricao: a.descricao, trecho: a.trecho, pagina: Number(a.pagina) || undefined }));
  if (doSistema.length === 0 && ia.length === 0) return null;
  return (
    <section role="alert" className="mb-8 rounded-lg border border-obice/25 bg-folha">
      <header className="flex items-start gap-3 border-b border-obice/15 bg-obice-fundo px-5 py-3.5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-obice" />
        <div>
          <h2 className="text-[15px] font-semibold text-obice">Instruções à IA encontradas nos autos</h2>
          <p className="mt-0.5 text-[13px] text-tinta-2">
            Há trechos que tentam dar ordens ao sistema de IA. Eles foram tratados como texto e não como comando, mas confira a análise e a minuta com atenção redobrada e
            avalie se o caso deve ser comunicado.
          </p>
        </div>
      </header>
      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        {doSistema.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-tinta-3">Encontrado pela varredura do sistema</h3>
            <AlertasInjecaoLista alertas={doSistema} />
          </div>
        )}
        {ia.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-tinta-3">Apontado pela IA na leitura das peças</h3>
            <AlertasInjecaoLista alertas={ia} />
          </div>
        )}
      </div>
    </section>
  );
};
