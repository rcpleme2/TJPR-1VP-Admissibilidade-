import React, { useEffect, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { ChecklistSecao, ChecklistStatus } from '../types/admissibility';
import { Abas, campo, Folha, type Tom } from './ui';

interface ChecklistViewProps {
  sections: ChecklistSecao[];
  onUpdateItemStatus?: (sectionCode: string, itemId: string, newStatus: ChecklistStatus) => void;
  onUpdateItemNote?: (sectionCode: string, itemId: string, note: string) => void;
  /** Seção preliminar exibida antes dos requisitos (sobrestamento). */
  preliminar?: React.ReactNode;
}

type Filtro = 'all' | 'nao_conforme' | 'atencao' | 'conforme' | 'novidade2026';

const STATUS: Record<ChecklistStatus, { rotulo: string; tom: Tom }> = {
  conforme: { rotulo: 'Conforme', tom: 'ok' },
  nao_conforme: { rotulo: 'Óbice', tom: 'obice' },
  atencao: { rotulo: 'Verificar', tom: 'atencao' },
  nao_aplicavel: { rotulo: 'Não se aplica', tom: 'neutro' },
};

const COR: Record<Tom, string> = { ok: 'text-ok', obice: 'text-obice', atencao: 'text-atencao', neutro: 'text-tinta-3' };
const FUNDO: Record<Tom, string> = { ok: 'bg-ok', obice: 'bg-obice', atencao: 'bg-atencao', neutro: 'bg-linha-forte' };

/** Rascunho local enquanto digita; grava ao sair do campo. Acompanha o valor quando ele muda de fora (versão restaurada). */
const NotaItem: React.FC<{ id: string; valor: string; onSalvar: (v: string) => void }> = ({ id, valor, onSalvar }) => {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      id={id}
      type="text"
      value={texto}
      placeholder="Ressalva do assessor (vai para o relatório em PDF)"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => texto !== valor && onSalvar(texto)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`${campo} h-8 border-dashed text-[13px] focus:border-solid`}
    />
  );
};

export const ChecklistView: React.FC<ChecklistViewProps> = ({ sections, onUpdateItemStatus, onUpdateItemNote, preliminar }) => {
  const [statusFilter, setStatusFilter] = useState<Filtro>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const todos = sections.flatMap((s) => s.itens);
  const contar = (f: (i: (typeof todos)[number]) => boolean) => todos.filter(f).length;

  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      itens: sec.itens.filter((item) => {
        if (statusFilter === 'novidade2026' && !item.novidade2026) return false;
        if (statusFilter !== 'all' && statusFilter !== 'novidade2026' && item.status !== statusFilter) return false;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return [item.titulo, item.analiseTecnica, item.fundamentoLegal, item.id].some((t) => (t || '').toLowerCase().includes(q));
      }),
    }))
    .filter((sec) => sec.itens.length > 0);

  const abas: Array<{ id: Filtro; rotulo: string; contagem: number; alerta?: boolean }> = [
    { id: 'all', rotulo: 'Todos', contagem: todos.length },
    { id: 'nao_conforme', rotulo: 'Óbices', contagem: contar((i) => i.status === 'nao_conforme'), alerta: true },
    { id: 'atencao', rotulo: 'A verificar', contagem: contar((i) => i.status === 'atencao') },
    { id: 'conforme', rotulo: 'Conformes', contagem: contar((i) => i.status === 'conforme') },
    { id: 'novidade2026', rotulo: 'Reforma de 2026', contagem: contar((i) => Boolean(i.novidade2026)) },
  ];
  abas[1]!.alerta = abas[1]!.contagem > 0;

  return (
    <div className="space-y-6">
      {preliminar && <div id="preliminar">{preliminar}</div>}

      <div className="flex flex-col gap-3 border-b border-linha md:flex-row md:items-end md:justify-between">
        <Abas rotulo="Filtrar itens" itens={abas} ativa={statusFilter} onChange={setStatusFilter} />
        <div className="relative pb-2 md:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-[18px] size-4 -translate-y-1/2 text-tinta-3" />
          <input
            type="search"
            aria-label="Buscar no checklist"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Súmula, artigo ou tese"
            className={`${campo} pl-8`}
          />
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <p className="py-10 text-center text-sm text-tinta-3">Nenhum item neste filtro.</p>
      ) : (
        filteredSections.map((sec) => (
          <Folha key={sec.secaoCodigo} aria-labelledby={`sec-${sec.secaoCodigo}`}>
            <div className="flex items-baseline gap-3 border-b border-linha px-5 py-4 sm:px-6">
              <span className="font-serif text-[22px] font-semibold leading-none text-toga">{sec.secaoCodigo}</span>
              <h3 id={`sec-${sec.secaoCodigo}`} className="font-serif text-[18px] font-semibold leading-tight text-tinta">
                {sec.secaoTitulo.replace(new RegExp(`^${sec.secaoCodigo}[.)\\s–-]+`), '')}
              </h3>
            </div>

            <ul className="divide-y divide-linha">
              {sec.itens.map((item) => {
                const st = STATUS[item.status];
                const aberto = expandedItems[item.id] ?? (item.status === 'nao_conforme' || item.status === 'atencao');
                return (
                  <li key={item.id} className="relative px-5 py-4 sm:px-6">
                    <span aria-hidden className={`absolute bottom-0 left-0 top-0 w-[3px] ${item.status === 'nao_conforme' || item.status === 'atencao' ? FUNDO[st.tom] : ''}`} />
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedItems((prev) => ({ ...prev, [item.id]: !aberto }))}
                        aria-expanded={aberto}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span className="num mt-px w-9 shrink-0 text-[13px] text-tinta-3">{item.id}</span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium leading-snug text-tinta">{item.titulo}</span>
                          {item.novidade2026 && <span className="mt-0.5 block text-[13px] text-tinta-3">Lei 15.484/2026</span>}
                        </span>
                        <ChevronDown className={`ml-auto mt-0.5 size-4 shrink-0 text-tinta-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                      </button>

                      {onUpdateItemStatus ? (
                        <select
                          aria-label={`Situação do item ${item.id}`}
                          value={item.status}
                          onChange={(e) => onUpdateItemStatus(sec.secaoCodigo, item.id, e.target.value as ChecklistStatus)}
                          className={`h-8 w-[9.5rem] shrink-0 rounded-md border border-linha bg-folha pl-2.5 pr-7 text-[13px] font-medium hover:border-linha-forte focus:border-toga focus:outline-none ${COR[st.tom]}`}
                        >
                          {(Object.keys(STATUS) as ChecklistStatus[]).map((s) => (
                            <option key={s} value={s} className="text-tinta">
                              {STATUS[s].rotulo}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[13px] font-medium ${COR[st.tom]}`}>{st.rotulo}</span>
                      )}
                    </div>

                    {aberto && (
                      <div className="mt-3 space-y-3 pl-12">
                        <p className="max-w-[72ch] text-sm leading-relaxed text-tinta-2">{item.analiseTecnica}</p>
                        {item.fundamentoLegal && (
                          <p className="text-[13px] text-tinta-3">
                            <span className="text-tinta-2">Fundamento:</span> {item.fundamentoLegal}
                          </p>
                        )}
                        {item.trechoRelevante && (
                          <blockquote className="max-w-[72ch] border-l-2 border-linha-forte pl-3.5 font-serif text-[14px] italic leading-relaxed text-tinta-2">
                            {item.trechoRelevante}
                          </blockquote>
                        )}
                        {onUpdateItemNote && (
                          <div>
                            <label htmlFor={`nota-${item.id}`} className="sr-only">
                              Ressalva do assessor para o item {item.id}
                            </label>
                            <NotaItem id={`nota-${item.id}`} valor={item.observacaoAssessor || ''} onSalvar={(v) => onUpdateItemNote(sec.secaoCodigo, item.id, v)} />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Folha>
        ))
      )}
    </div>
  );
};
