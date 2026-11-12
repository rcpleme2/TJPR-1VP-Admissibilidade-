import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Filter,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Bookmark,
  Edit3,
} from 'lucide-react';
import { ChecklistItem, ChecklistSecao, ChecklistStatus } from '../types/admissibility';

interface ChecklistViewProps {
  sections: ChecklistSecao[];
  onUpdateItemStatus?: (sectionCode: string, itemId: string, newStatus: ChecklistStatus) => void;
  onUpdateItemNote?: (sectionCode: string, itemId: string, note: string) => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  sections,
  onUpdateItemStatus,
  onUpdateItemNote,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'nao_conforme' | 'atencao' | 'conforme' | 'novidade2026'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusIcon = (status: ChecklistStatus) => {
    switch (status) {
      case 'conforme':
        return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
      case 'nao_conforme':
        return <XCircle className="w-4 h-4 text-rose-700" />;
      case 'atencao':
        return <AlertTriangle className="w-4 h-4 text-amber-700" />;
      case 'nao_aplicavel':
      default:
        return <MinusCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: ChecklistStatus) => {
    switch (status) {
      case 'conforme':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Conforme
          </span>
        );
      case 'nao_conforme':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            Não Conforme / Óbice
          </span>
        );
      case 'atencao':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Atenção / Verificar
          </span>
        );
      case 'nao_aplicavel':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Não Aplicável
          </span>
        );
    }
  };

  // Filter sections and items
  const filteredSections = sections
    .map((sec) => {
      const filteredItems = sec.itens.filter((item) => {
        if (statusFilter === 'nao_conforme' && item.status !== 'nao_conforme') return false;
        if (statusFilter === 'atencao' && item.status !== 'atencao') return false;
        if (statusFilter === 'conforme' && item.status !== 'conforme') return false;
        if (statusFilter === 'novidade2026' && !item.novidade2026) return false;

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.titulo.toLowerCase().includes(q);
          const matchAnalysis = (item.analiseTecnica || '').toLowerCase().includes(q);
          const matchFund = (item.fundamentoLegal || '').toLowerCase().includes(q);
          const matchId = item.id.toLowerCase().includes(q);
          return matchTitle || matchAnalysis || matchFund || matchId;
        }

        return true;
      });

      return {
        ...sec,
        itens: filteredItems,
      };
    })
    .filter((sec) => sec.itens.length > 0);

  // Stats
  let totalItems = 0;
  let conformes = 0;
  let naoConformes = 0;
  let atencoes = 0;
  let novidades2026 = 0;

  sections.forEach((sec) => {
    sec.itens.forEach((it) => {
      totalItems++;
      if (it.status === 'conforme') conformes++;
      if (it.status === 'nao_conforme') naoConformes++;
      if (it.status === 'atencao') atencoes++;
      if (it.novidade2026) novidades2026++;
    });
  });

  return (
    <div className="space-y-6">
      {/* Control Bar: Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            Todos ({totalItems})
          </button>

          <button
            onClick={() => setStatusFilter('nao_conforme')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              statusFilter === 'nao_conforme'
                ? 'bg-rose-800 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Óbices ({naoConformes})</span>
          </button>

          <button
            onClick={() => setStatusFilter('atencao')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              statusFilter === 'atencao'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Atenção ({atencoes})</span>
          </button>

          <button
            onClick={() => setStatusFilter('conforme')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              statusFilter === 'conforme'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Conformes ({conformes})</span>
          </button>

          <button
            onClick={() => setStatusFilter('novidade2026')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              statusFilter === 'novidade2026'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Reforma 2026 ({novidades2026})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por súmula, artigo ou tese..."
            className="w-full bg-slate-50 text-xs text-slate-800 pl-9 pr-3 py-2 rounded-xl border border-slate-300 outline-none focus:border-slate-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-5">
        {filteredSections.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 shadow-xs">
            Nenhum item encontrado para o filtro selecionado.
          </div>
        ) : (
          filteredSections.map((sec) => (
            <div
              key={sec.secaoCodigo}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Section Header */}
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center">
                    {sec.secaoCodigo}
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                    {sec.secaoTitulo}
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {sec.itens.length} {sec.itens.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100">
                {sec.itens.map((item) => {
                  const isExpanded = expandedItems[item.id] !== false;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition ${
                        item.status === 'nao_conforme'
                          ? 'bg-rose-50/30 hover:bg-rose-50/50'
                          : item.status === 'atencao'
                          ? 'bg-amber-50/30 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">{getStatusIcon(item.status)}</div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-500">{item.id}</span>
                              <h4 className="text-xs sm:text-sm font-semibold text-slate-800">{item.titulo}</h4>
                              {item.novidade2026 && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  Lei 15.484/2026
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">{getStatusBadge(item.status)}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Manual Override Status Picker */}
                          {onUpdateItemStatus && (
                            <select
                              value={item.status}
                              onChange={(e) =>
                                onUpdateItemStatus(sec.secaoCodigo, item.id, e.target.value as ChecklistStatus)
                              }
                              className="text-[11px] bg-slate-50 text-slate-700 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:border-slate-500"
                              title="Alterar status manualmente"
                            >
                              <option value="conforme">Conforme</option>
                              <option value="nao_conforme">Não Conforme</option>
                              <option value="atencao">Atenção</option>
                              <option value="nao_aplicavel">Não Aplicável</option>
                            </select>
                          )}

                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                            title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Technical Details */}
                      {isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs space-y-3 pl-7">
                          {/* Análise Técnica */}
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                              Análise Técnica da Assessoria:
                            </span>
                            <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                              {item.analiseTecnica}
                            </p>
                          </div>

                          {/* Fundamento Legal */}
                          {item.fundamentoLegal && (
                            <div className="flex items-start gap-2 text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                              <Bookmark className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                              <span className="text-[11px]">
                                <strong>Fundamento Normativo / Súmula:</strong> {item.fundamentoLegal}
                              </span>
                            </div>
                          )}

                          {/* Trecho Relevante Extraído */}
                          {item.trechoRelevante && (
                            <div className="flex items-start gap-2 text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-xl italic font-serif">
                              <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0 not-italic" />
                              <span className="text-[11px]">"{item.trechoRelevante}"</span>
                            </div>
                          )}

                          {/* Assessor Notes Box */}
                          {onUpdateItemNote && (
                            <div className="pt-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                  <Edit3 className="w-3 h-3 text-slate-500" />
                                  Anotação / Ressalva do Assessor para este Item:
                                </span>
                              </div>
                              <input
                                type="text"
                                defaultValue={item.observacaoAssessor || ''}
                                placeholder="Digite sua ressalva pessoal que constará no relatório PDF..."
                                onBlur={(e) => onUpdateItemNote(sec.secaoCodigo, item.id, e.target.value)}
                                className="w-full bg-white text-xs text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-slate-500 placeholder:text-slate-400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
