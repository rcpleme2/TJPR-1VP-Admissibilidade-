import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Copy, Download, ExternalLink, Pencil, Search, Upload } from 'lucide-react';
import { consultarBase, type FiltroTipo, type FiltroTribunal } from '../../shared/consulta';
import type { EntradaBase } from '../../shared/precedentesBase';
import { exportarBase, importarBase } from '../lib/baseIO';

interface Props {
  baseCustom: EntradaBase[];
  onBaseChange: (b: EntradaBase[]) => void;
  onClose: () => void;
}

const SIT = {
  vigente: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelada: 'bg-rose-50 text-rose-800 border-rose-200',
  superada: 'bg-amber-50 text-amber-800 border-amber-200',
} as const;

const VAZIO: EntradaBase = { tipo: 'sumula', tribunal: 'STJ', numero: '', enunciado: '', situacao: 'vigente', palavrasChave: [], fonte: 'usuario' };

export const ConsultaPrecedentes: React.FC<Props> = ({ baseCustom, onBaseChange, onClose }) => {
  const [q, setQ] = useState('');
  const [tribunal, setTribunal] = useState<FiltroTribunal>('todos');
  const [tipo, setTipo] = useState<FiltroTipo>('todos');
  const [copiado, setCopiado] = useState('');
  const [form, setForm] = useState<EntradaBase | null>(null);
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  const r = useMemo(() => consultarBase(q, baseCustom, { tribunal, tipo }), [q, baseCustom, tribunal, tipo]);

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      setMsg('Não foi possível copiar automaticamente.');
    }
  };

  const salvar = () => {
    if (!form) return;
    if (!/^\d{1,4}$/.test(form.numero.trim()) || form.enunciado.trim().length < 5) return setMsg('Informe o número e o enunciado/tese.');
    const e: EntradaBase = { ...form, numero: form.numero.trim(), tribunal: form.tipo === 'sumula_vinculante' ? 'STF' : form.tribunal, enunciado: form.enunciado.trim(), fonte: 'usuario' };
    onBaseChange([...baseCustom.filter((b) => !(b.tipo === e.tipo && b.tribunal === e.tribunal && b.numero === e.numero)), e]);
    setForm(null);
    setMsg('Salvo na sua base (fica apenas neste navegador; use Exportar para guardar ou compartilhar).');
  };

  const campo = 'bg-slate-50 text-xs text-slate-800 border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:border-slate-500';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-600" /> Consulta de súmulas e precedentes vinculantes
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Consulta direta à base local, sem IA e sem enviar nada a terceiros. A base inicial é parcial: o que não constar dela deve ser
              conferido no portal oficial (STJ/STF), e você pode cadastrar na sua própria base o que conferir.
            </p>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            type="search"
            aria-label="Buscar súmula, súmula vinculante ou tema"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: súmula 7 stj · SV 10 · 283 · reexame de prova · prequestionamento"
            className="w-full bg-slate-50 text-sm text-slate-900 border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 outline-none focus:border-slate-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tribunal" value={tribunal} onChange={(e) => setTribunal(e.target.value as FiltroTribunal)} className={campo}>
            <option value="todos">STJ e STF</option>
            <option value="STJ">Somente STJ</option>
            <option value="STF">Somente STF</option>
          </select>
          <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)} className={campo}>
            <option value="todos">Todos os tipos</option>
            <option value="sumula">Súmulas</option>
            <option value="sumula_vinculante">Súmulas vinculantes</option>
            <option value="tema">Temas / teses</option>
          </select>
          <span className="text-xs text-slate-500" role="status">
            {r.resultados.length} resultado(s)
          </span>
          <span className="flex-1" />
          <button onClick={() => setForm({ ...VAZIO })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            <Pencil className="w-3.5 h-3.5" /> Cadastrar na minha base
          </button>
          <button onClick={() => exportarBase(baseCustom)} disabled={baseCustom.length === 0} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Exportar ({baseCustom.length})
          </button>
          <button onClick={() => arquivo.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5" /> Importar
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const j = await importarBase(f);
                onBaseChange(j);
                setMsg(`${j.length} registro(s) importado(s).`);
              } catch {
                setMsg('Arquivo inválido. Use um JSON exportado por este sistema.');
              }
            }}
          />
        </div>
        {msg && (
          <p role="status" className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {msg}
          </p>
        )}
      </div>

      {form && (
        <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Cadastrar / corrigir na minha base</h3>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as EntradaBase['tipo'] })} className={campo}>
              <option value="sumula">Súmula</option>
              <option value="sumula_vinculante">Súmula vinculante</option>
              <option value="tema">Tema</option>
            </select>
            {form.tipo !== 'sumula_vinculante' && (
              <select aria-label="Tribunal" value={form.tribunal} onChange={(e) => setForm({ ...form, tribunal: e.target.value as 'STJ' | 'STF' })} className={campo}>
                <option>STJ</option>
                <option>STF</option>
              </select>
            )}
            <input aria-label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="nº" className={`${campo} w-24`} />
            <select aria-label="Situação" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as EntradaBase['situacao'] })} className={campo}>
              <option value="vigente">Vigente</option>
              <option value="cancelada">Cancelada</option>
              <option value="superada">Superada</option>
            </select>
          </div>
          <textarea aria-label="Enunciado ou tese" rows={3} value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} placeholder="Enunciado/tese, copiado do portal oficial" className={`${campo} w-full`} />
          <input
            aria-label="Palavras-chave"
            value={form.palavrasChave.join(', ')}
            onChange={(e) => setForm({ ...form, palavrasChave: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            placeholder="Palavras-chave (opcional, separadas por vírgula) – ajudam a checar a pertinência das citações"
            className={`${campo} w-full`}
          />
          <div className="flex gap-2">
            <button onClick={salvar} className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              Salvar
            </button>
            <button onClick={() => setForm(null)} className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 bg-white hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {r.naoEncontrados.map((n) => (
        <div key={n.rotulo} className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
          <p className="font-bold text-slate-900 text-sm">{n.rotulo}</p>
          <p className="text-slate-700">{n.verificacao.mensagem}</p>
          <div className="flex gap-2">
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir no portal oficial
            </a>
            {n.verificacao.status !== 'inexistente' && (
              <button onClick={() => setForm({ ...VAZIO, tipo: n.tipo, tribunal: n.tribunal ?? 'STJ', numero: n.numero })} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
                Cadastrar após conferir
              </button>
            )}
          </div>
        </div>
      ))}

      {r.resultados.length === 0 && r.naoEncontrados.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
          Nada encontrado na base local para esta busca. Tente outras palavras ou consulte o portal oficial do{' '}
          <a className="underline" href="https://scon.stj.jus.br/SCON/sumanot/" target="_blank" rel="noopener noreferrer">STJ</a> e do{' '}
          <a className="underline" href="https://jurisprudencia.stf.jus.br/pages/search?base=sumulas" target="_blank" rel="noopener noreferrer">STF</a>.
        </div>
      )}

      <div className="space-y-3">
        {r.resultados.map(({ entrada: e, rotulo, link, noUsuario }) => {
          const id = `${e.tipo}-${e.tribunal}-${e.numero}`;
          return (
            <article key={id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{rotulo}</h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${SIT[e.situacao]}`}>{e.situacao}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">{noUsuario ? 'sua base' : 'base inicial'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copiar(id, `${rotulo}: ${e.enunciado}`)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                    {copiado === id ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />} {copiado === id ? 'Copiado' : 'Copiar'}
                  </button>
                  <button onClick={() => setForm({ ...e })} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                    <Pencil className="w-3.5 h-3.5" /> Corrigir
                  </button>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                    <ExternalLink className="w-3.5 h-3.5" /> Portal oficial
                  </a>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-800 font-serif leading-relaxed">{e.enunciado}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
};
