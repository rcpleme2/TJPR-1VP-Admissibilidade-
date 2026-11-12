import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  HelpCircle,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { criarCitacaoManual, resumoPrecedentes } from '../../shared/precedentes';
import type { EntradaBase } from '../../shared/precedentesBase';
import type { CitacaoPrecedente } from '../types/admissibility';

interface Props {
  citacoes: CitacaoPrecedente[];
  baseCustom: EntradaBase[];
  onChange: (c: CitacaoPrecedente[]) => void;
  onReverificar: () => void;
  onBaseChange: (b: EntradaBase[]) => void;
}

type StatusV = CitacaoPrecedente['verificacao']['status'];

const STATUS: Record<StatusV, { rotulo: string; classe: string; Icon: typeof CheckCircle2 }> = {
  confirmada: { rotulo: 'Confirmada na base', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  nao_encontrada_na_base: { rotulo: 'Fora da base – conferir', classe: 'bg-amber-50 text-amber-800 border-amber-200', Icon: HelpCircle },
  requer_conferencia: { rotulo: 'Conferir no portal', classe: 'bg-amber-50 text-amber-800 border-amber-200', Icon: HelpCircle },
  tribunal_indefinido: { rotulo: 'Tribunal indefinido', classe: 'bg-amber-50 text-amber-800 border-amber-200', Icon: HelpCircle },
  cancelada_ou_superada: { rotulo: 'Cancelada / superada', classe: 'bg-rose-50 text-rose-800 border-rose-200', Icon: AlertTriangle },
  inexistente: { rotulo: 'Inexistente (provável)', classe: 'bg-rose-50 text-rose-800 border-rose-200', Icon: XCircle },
};

const SITUACOES: Array<{ v: CitacaoPrecedente['conferencia']['situacao']; r: string }> = [
  { v: 'pendente', r: 'Pendente' },
  { v: 'conferido', r: 'Conferido por mim' },
  { v: 'divergente', r: 'Divergente – corrigir minuta' },
  { v: 'descartado', r: 'Descartado' },
];

export const PrecedentsView: React.FC<Props> = ({ citacoes, baseCustom, onChange, onReverificar, onBaseChange }) => {
  const [filtro, setFiltro] = useState<'todos' | 'alertas' | 'pendentes'>('todos');
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [novo, setNovo] = useState<{ tipo: CitacaoPrecedente['tipo']; tribunal: 'STJ' | 'STF'; numero: string }>({ tipo: 'sumula', tribunal: 'STJ', numero: '' });
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const resumo = resumoPrecedentes(citacoes);

  const atualizar = (id: string, parcial: Partial<CitacaoPrecedente['conferencia']>) =>
    onChange(citacoes.map((c) => (c.id === id ? { ...c, conferencia: { ...c.conferencia, ...parcial } } : c)));

  const visiveis = citacoes.filter((c) => {
    if (filtro === 'alertas') return ['inexistente', 'cancelada_ou_superada', 'tribunal_indefinido'].includes(c.verificacao.status) || c.verificacao.coerencia === 'verificar';
    if (filtro === 'pendentes') return c.conferencia.situacao === 'pendente';
    return true;
  });

  const adicionar = () => {
    if (!/^[\w .\-/]{1,40}$/.test(novo.numero.trim())) return setMsg('Informe um número válido.');
    const c = criarCitacaoManual(novo.tipo, novo.tipo === 'sumula_vinculante' ? 'STF' : novo.tribunal, novo.numero, baseCustom);
    if (citacoes.some((x) => x.id === c.id)) return setMsg('Esse precedente já está na lista.');
    onChange([c, ...citacoes]);
    setNovo({ ...novo, numero: '' });
    setMsg('');
  };

  const cadastrarNaBase = (c: CitacaoPrecedente, situacao: EntradaBase['situacao']) => {
    const enunciado = (c.conferencia.enunciadoConferido ?? '').trim();
    if (!enunciado || c.tipo === 'acordao' || !c.tribunal) {
      return setMsg('Preencha o enunciado/tese conferido (e o tribunal) para cadastrar na base.');
    }
    const entrada: EntradaBase = { tipo: c.tipo, tribunal: c.tribunal, numero: c.numero, enunciado, situacao, palavrasChave: [], fonte: 'usuario' };
    onBaseChange([...baseCustom.filter((b) => !(b.tipo === entrada.tipo && b.tribunal === entrada.tribunal && b.numero === entrada.numero)), entrada]);
    setMsg(`${c.rotulo} cadastrado na sua base. Clique em "Reverificar" para aplicar.`);
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(baseCustom, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'base-precedentes-tjpr1vp.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as EntradaBase[];
      const ok = Array.isArray(j) && j.every((e) => e && ['sumula', 'sumula_vinculante', 'tema'].includes(e.tipo) && ['STJ', 'STF'].includes(e.tribunal) && typeof e.numero === 'string' && typeof e.enunciado === 'string');
      if (!ok) throw new Error();
      onBaseChange(j.map((e) => ({ ...e, palavrasChave: Array.isArray(e.palavrasChave) ? e.palavrasChave : [], situacao: e.situacao ?? 'vigente', fonte: 'usuario' as const })));
      setMsg(`${j.length} registro(s) importado(s).`);
    } catch {
      setMsg('Arquivo inválido. Use um JSON exportado por este sistema.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-slate-600" /> Verificação de súmulas, temas e precedentes (STJ / STF)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              O sistema extrai as citações da minuta e do checklist e as confronta com a base local. A base é inicial e não
              exaustiva: o que não consta dela exige conferência no portal oficial. Marque cada item como conferido ou divergente;
              suas marcações são salvas com a análise.
            </p>
          </div>
          <button onClick={onReverificar} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Reverificar minuta editada
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">Total: <b>{resumo.total}</b></span>
          <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">Confirmadas na base: <b>{resumo.confirmadas}</b></span>
          <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">Alertas: <b>{resumo.alertas}</b></span>
          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">A conferir: <b>{resumo.aConferir}</b></span>
          <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">Conferidas por você: <b>{resumo.conferidasPeloUsuario}</b></span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <select aria-label="Filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5">
            <option value="todos">Todos</option>
            <option value="alertas">Somente alertas</option>
            <option value="pendentes">Somente pendentes</option>
          </select>
          <span className="text-slate-300">|</span>
          <select aria-label="Tipo" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as typeof novo.tipo })} className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5">
            <option value="sumula">Súmula</option>
            <option value="sumula_vinculante">Súmula Vinculante</option>
            <option value="tema">Tema</option>
          </select>
          {novo.tipo !== 'sumula_vinculante' && (
            <select aria-label="Tribunal" value={novo.tribunal} onChange={(e) => setNovo({ ...novo, tribunal: e.target.value as 'STJ' | 'STF' })} className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5">
              <option>STJ</option>
              <option>STF</option>
            </select>
          )}
          <input aria-label="Número" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} placeholder="nº" className="w-20 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5" />
          <button onClick={adicionar} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            <Plus className="w-3.5 h-3.5" /> Adicionar à lista
          </button>
          <span className="flex-1" />
          <button onClick={exportar} disabled={baseCustom.length === 0} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Exportar minha base ({baseCustom.length})
          </button>
          <button onClick={() => arquivo.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5" /> Importar
          </button>
          <input ref={arquivo} type="file" accept="application/json" className="hidden" onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {msg && <p role="status" className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{msg}</p>}
      </div>

      {visiveis.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">Nenhuma citação para exibir neste filtro.</div>
      )}

      <div className="space-y-3">
        {visiveis.map((c) => {
          const st = STATUS[c.verificacao.status];
          const aberto = abertos[c.id];
          return (
            <article key={c.id} className={`bg-white border rounded-2xl p-4 shadow-xs ${c.conferencia.situacao === 'descartado' ? 'opacity-60' : ''} border-slate-200`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{c.rotulo}</h4>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.classe}`}>
                    <st.Icon className="w-3 h-3" /> {st.rotulo}
                  </span>
                  {c.verificacao.coerencia === 'verificar' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">Pertinência a verificar</span>
                  )}
                  {c.manual && <span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">adicionada por você</span>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Situação da conferência de ${c.rotulo}`}
                    value={c.conferencia.situacao}
                    onChange={(e) => atualizar(c.id, { situacao: e.target.value as CitacaoPrecedente['conferencia']['situacao'] })}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5"
                  >
                    {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.r}</option>)}
                  </select>
                  <a href={c.linkOficial} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                    <ExternalLink className="w-3.5 h-3.5" /> Portal oficial
                  </a>
                  <button onClick={() => setAbertos({ ...abertos, [c.id]: !aberto })} aria-expanded={!!aberto} aria-label="Detalhes" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                    {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">{c.verificacao.mensagem}</p>

              {aberto && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <h5 className="font-semibold text-slate-700">Onde foi citada</h5>
                    {c.ocorrencias.length === 0 && <p className="text-slate-400">Sem ocorrência no texto (adicionada manualmente).</p>}
                    {c.ocorrencias.map((o, i) => (
                      <blockquote key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                        <span className="block text-[11px] font-semibold text-slate-500">{o.origem}</span>
                        <span className="font-serif text-slate-700">{o.contexto}</span>
                      </blockquote>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {c.verificacao.enunciadoOficial && (
                      <>
                        <h5 className="font-semibold text-slate-700">Enunciado na base local</h5>
                        <p className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2 font-serif text-slate-800">{c.verificacao.enunciadoOficial}</p>
                      </>
                    )}
                    <label className="block font-semibold text-slate-700" htmlFor={`enc-${c.id}`}>Enunciado/tese conferido por você no portal</label>
                    <textarea id={`enc-${c.id}`} rows={3} value={c.conferencia.enunciadoConferido ?? ''} onChange={(e) => atualizar(c.id, { enunciadoConferido: e.target.value })} className="w-full bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-slate-500" />
                    <label className="block font-semibold text-slate-700" htmlFor={`obs-${c.id}`}>Observação</label>
                    <input id={`obs-${c.id}`} value={c.conferencia.observacao ?? ''} onChange={(e) => atualizar(c.id, { observacao: e.target.value })} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-slate-500" />
                    {c.tipo !== 'acordao' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => cadastrarNaBase(c, 'vigente')} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cadastrar na minha base (vigente)</button>
                        <button onClick={() => cadastrarNaBase(c, 'cancelada')} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">Cadastrar como cancelada/superada</button>
                      </div>
                    )}
                    {c.manual && (
                      <button onClick={() => onChange(citacoes.filter((x) => x.id !== c.id))} className="inline-flex items-center gap-1 text-rose-700 hover:underline pt-1">
                        <Trash2 className="w-3.5 h-3.5" /> Remover da lista
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
