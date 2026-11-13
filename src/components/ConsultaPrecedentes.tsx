import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, ExternalLink, Pencil, Plus, Search, Upload } from 'lucide-react';
import { consultarBase, type FiltroTipo, type FiltroTribunal } from '../../shared/consulta';
import type { EntradaBase } from '../../shared/precedentesBase';
import { exportarBase, importarBase } from '../lib/baseIO';
import { Botao, campo, campoArea, campoSelect, Folha, Marca, TituloSecao, type Tom } from './ui';

interface Props {
  baseCustom: EntradaBase[];
  onBaseChange: (b: EntradaBase[]) => void;
  onClose: () => void;
}

const SIT: Record<EntradaBase['situacao'], { r: string; tom: Tom }> = {
  vigente: { r: 'Vigente', tom: 'ok' },
  cancelada: { r: 'Cancelada', tom: 'obice' },
  superada: { r: 'Superada', tom: 'atencao' },
};

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

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form) return;
    if (!/^\d{1,4}$/.test(form.numero.trim()) || form.enunciado.trim().length < 5) return setMsg('Informe o número e o enunciado.');
    const e: EntradaBase = { ...form, numero: form.numero.trim(), tribunal: form.tipo === 'sumula_vinculante' ? 'STF' : form.tribunal, enunciado: form.enunciado.trim(), fonte: 'usuario' };
    onBaseChange([...baseCustom.filter((b) => !(b.tipo === e.tipo && b.tribunal === e.tribunal && b.numero === e.numero)), e]);
    setForm(null);
    setMsg('Salvo na base da equipe.');
  };

  return (
    <div className="space-y-8">
      <div>
        <button type="button" onClick={onClose} className="-ml-1 inline-flex items-center gap-1.5 rounded px-1 text-[13px] text-tinta-3 hover:text-tinta">
          <ArrowLeft className="size-3.5" /> Voltar
        </button>
        <h1 className="mt-3 font-serif text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-tinta">Súmulas e precedentes</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-tinta-2">Consulta direta à base local, sem IA e sem envio a terceiros. O que não constar dela deve ser conferido no portal do STJ ou do STF.</p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
          <input
            autoFocus
            type="search"
            aria-label="Buscar súmula, súmula vinculante ou tema"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Súmula 7 STJ, SV 10, reexame de prova, prequestionamento…"
            className={`${campo} h-12 pl-11 text-[15px]`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Tribunal" value={tribunal} onChange={(e) => setTribunal(e.target.value as FiltroTribunal)} className={`${campoSelect} h-8 w-auto text-[13px]`}>
            <option value="todos">STJ e STF</option>
            <option value="STJ">STJ</option>
            <option value="STF">STF</option>
          </select>
          <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)} className={`${campoSelect} h-8 w-auto text-[13px]`}>
            <option value="todos">Todos os tipos</option>
            <option value="sumula">Súmulas</option>
            <option value="sumula_vinculante">Súmulas vinculantes</option>
            <option value="tema">Temas</option>
          </select>
          <span className="num text-[13px] text-tinta-3" role="status">
            {r.resultados.length === 1 ? '1 resultado' : `${r.resultados.length} resultados`}
          </span>
          <span className="flex-1" />
          <Botao tamanho="sm" variante="discreto" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="size-3.5" /> Cadastrar
          </Botao>
          <Botao tamanho="sm" variante="discreto" onClick={() => exportarBase(baseCustom)} disabled={baseCustom.length === 0}>
            <Download className="size-3.5" /> Exportar
          </Botao>
          <Botao tamanho="sm" variante="discreto" onClick={() => arquivo.current?.click()}>
            <Upload className="size-3.5" /> Importar
          </Botao>
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
          <p role="status" className="text-sm text-tinta-2">
            {msg}
          </p>
        )}
      </div>

      {form && (
        <Folha as="div" className="p-6">
          <form onSubmit={salvar} className="space-y-4">
            <TituloSecao as="h2" className="!text-[17px]">
              Cadastrar ou corrigir na base
            </TituloSecao>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as EntradaBase['tipo'] })} className={`${campoSelect} w-auto`}>
                <option value="sumula">Súmula</option>
                <option value="sumula_vinculante">Súmula vinculante</option>
                <option value="tema">Tema</option>
              </select>
              {form.tipo !== 'sumula_vinculante' && (
                <select aria-label="Tribunal" value={form.tribunal} onChange={(e) => setForm({ ...form, tribunal: e.target.value as 'STJ' | 'STF' })} className={`${campoSelect} w-auto`}>
                  <option>STJ</option>
                  <option>STF</option>
                </select>
              )}
              <input aria-label="Número" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="nº" className={`${campo} w-24`} />
              <select aria-label="Situação" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value as EntradaBase['situacao'] })} className={`${campoSelect} w-auto`}>
                <option value="vigente">Vigente</option>
                <option value="cancelada">Cancelada</option>
                <option value="superada">Superada</option>
              </select>
            </div>
            <textarea aria-label="Enunciado ou tese" rows={3} value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} placeholder="Enunciado ou tese, copiado do portal oficial" className={`${campoArea} font-serif`} />
            <input
              aria-label="Palavras-chave"
              value={form.palavrasChave.join(', ')}
              onChange={(e) => setForm({ ...form, palavrasChave: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
              placeholder="Palavras-chave separadas por vírgula (opcional)"
              className={campo}
            />
            <div className="flex gap-2">
              <Botao type="submit" variante="primario">
                Salvar
              </Botao>
              <Botao variante="discreto" onClick={() => setForm(null)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Folha>
      )}

      {r.naoEncontrados.map((n) => (
        <div key={n.rotulo} className="border-l-2 border-atencao pl-4">
          <p className="font-serif text-[17px] font-semibold text-tinta">{n.rotulo}</p>
          <p className="mt-1 text-sm text-tinta-2">{n.verificacao.mensagem}</p>
          <div className="mt-2 flex gap-1.5">
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-linha-forte bg-folha px-2.5 text-[13px] font-medium text-tinta hover:border-tinta-3">
              <ExternalLink className="size-3.5" /> Abrir no portal
            </a>
            {n.verificacao.status !== 'inexistente' && (
              <Botao tamanho="sm" variante="discreto" onClick={() => setForm({ ...VAZIO, tipo: n.tipo, tribunal: n.tribunal ?? 'STJ', numero: n.numero })}>
                Cadastrar após conferir
              </Botao>
            )}
          </div>
        </div>
      ))}

      {r.resultados.length === 0 && r.naoEncontrados.length === 0 && (
        <p className="py-6 text-sm text-tinta-3">
          Nada na base local para esta busca. Tente outras palavras ou consulte o portal do{' '}
          <a className="text-toga underline underline-offset-2" href="https://scon.stj.jus.br/SCON/sumanot/" target="_blank" rel="noopener noreferrer">
            STJ
          </a>{' '}
          e do{' '}
          <a className="text-toga underline underline-offset-2" href="https://jurisprudencia.stf.jus.br/pages/search?base=sumulas" target="_blank" rel="noopener noreferrer">
            STF
          </a>
          .
        </p>
      )}

      {r.resultados.length > 0 && (
        <Folha as="div">
          <ul className="divide-y divide-linha">
            {r.resultados.map(({ entrada: e, rotulo, link, noUsuario }) => {
              const id = `${e.tipo}-${e.tribunal}-${e.numero}`;
              const sit = SIT[e.situacao];
              return (
                <li key={id} className="group px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-serif text-[18px] font-semibold text-tinta">{rotulo}</h3>
                      <Marca tom={sit.tom}>{sit.r}</Marca>
                      {noUsuario && <span className="text-[13px] text-tinta-3">cadastrada pela equipe</span>}
                    </div>
                    <div className="flex items-center gap-0.5 text-tinta-3">
                      <button type="button" onClick={() => copiar(id, `${rotulo}: ${e.enunciado}`)} aria-label={`Copiar ${rotulo}`} title="Copiar" className="rounded-md p-1.5 hover:bg-papel hover:text-tinta">
                        {copiado === id ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
                      </button>
                      <button type="button" onClick={() => setForm({ ...e })} aria-label={`Corrigir ${rotulo}`} title="Corrigir" className="rounded-md p-1.5 hover:bg-papel hover:text-tinta">
                        <Pencil className="size-4" />
                      </button>
                      <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${rotulo} no portal oficial`} title="Portal oficial" className="rounded-md p-1.5 hover:bg-papel hover:text-toga">
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </div>
                  <p className="mt-2 max-w-[75ch] font-serif text-[16px] leading-[1.65] text-tinta">{e.enunciado}</p>
                </li>
              );
            })}
          </ul>
        </Folha>
      )}
    </div>
  );
};
