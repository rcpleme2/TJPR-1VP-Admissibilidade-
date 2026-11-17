import React, { useRef, useState } from 'react';
import { ChevronDown, Download, ExternalLink, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { criarCitacaoManual, resumoPrecedentes } from '../../shared/precedentes';
import type { EntradaBase } from '../../shared/precedentesBase';
import type { CitacaoPrecedente } from '../types/admissibility';
import { exportarBase, importarBase } from '../lib/baseIO';
import { Abas, Botao, campo, campoArea, Folha, Marca, type Tom } from './ui';

interface Props {
  citacoes: CitacaoPrecedente[];
  baseCustom: EntradaBase[];
  onChange: (c: CitacaoPrecedente[]) => void;
  onReverificar: () => void;
  onBaseChange: (b: EntradaBase[]) => void;
}

type StatusV = CitacaoPrecedente['verificacao']['status'];

const STATUS: Record<StatusV, { rotulo: string; tom: Tom }> = {
  confirmada: { rotulo: 'Confirmada na base', tom: 'ok' },
  nao_encontrada_na_base: { rotulo: 'Fora da base', tom: 'atencao' },
  requer_conferencia: { rotulo: 'Conferir no portal', tom: 'atencao' },
  tribunal_indefinido: { rotulo: 'Tribunal indefinido', tom: 'atencao' },
  cancelada_ou_superada: { rotulo: 'Cancelada ou superada', tom: 'obice' },
  inexistente: { rotulo: 'Provavelmente inexistente', tom: 'obice' },
};

const SITUACOES: Array<{ v: CitacaoPrecedente['conferencia']['situacao']; r: string }> = [
  { v: 'pendente', r: 'Pendente' },
  { v: 'conferido', r: 'Conferido' },
  { v: 'divergente', r: 'Divergente' },
  { v: 'descartado', r: 'Descartado' },
];

const mini = 'h-8 rounded-md border border-linha-forte bg-folha px-2 text-[13px] text-tinta focus:border-toga focus:outline-none';

export const PrecedentsView: React.FC<Props> = ({ citacoes, baseCustom, onChange, onReverificar, onBaseChange }) => {
  const [filtro, setFiltro] = useState<'todos' | 'alertas' | 'pendentes'>('todos');
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [novo, setNovo] = useState<{ tipo: CitacaoPrecedente['tipo']; tribunal: 'STJ' | 'STF'; numero: string }>({ tipo: 'sumula', tribunal: 'STJ', numero: '' });
  const [msg, setMsg] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const resumo = resumoPrecedentes(citacoes);

  const atualizar = (id: string, parcial: Partial<CitacaoPrecedente['conferencia']>) =>
    onChange(citacoes.map((c) => (c.id === id ? { ...c, conferencia: { ...c.conferencia, ...parcial } } : c)));

  const ehAlerta = (c: CitacaoPrecedente) => ['inexistente', 'cancelada_ou_superada', 'tribunal_indefinido'].includes(c.verificacao.status) || c.verificacao.coerencia === 'verificar';
  const visiveis = citacoes.filter((c) => (filtro === 'alertas' ? ehAlerta(c) : filtro === 'pendentes' ? c.conferencia.situacao === 'pendente' : true));

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[\w .\-/]{1,40}$/.test(novo.numero.trim())) return setMsg('Informe um número válido.');
    const c = criarCitacaoManual(novo.tipo, novo.tipo === 'sumula_vinculante' ? 'STF' : novo.tribunal, novo.numero, baseCustom);
    if (citacoes.some((x) => x.id === c.id)) return setMsg('Esse precedente já está na lista.');
    onChange([c, ...citacoes]);
    setNovo({ ...novo, numero: '' });
    setMsg('');
  };

  const cadastrarNaBase = (c: CitacaoPrecedente, situacao: EntradaBase['situacao']) => {
    const enunciado = (c.conferencia.enunciadoConferido ?? '').trim();
    if (!enunciado || c.tipo === 'acordao' || !c.tribunal) return setMsg('Preencha o enunciado conferido (e o tribunal) para cadastrar na base.');
    const entrada: EntradaBase = { tipo: c.tipo, tribunal: c.tribunal, numero: c.numero, enunciado, situacao, palavrasChave: [], fonte: 'usuario' };
    onBaseChange([...baseCustom.filter((b) => !(b.tipo === entrada.tipo && b.tribunal === entrada.tribunal && b.numero === entrada.numero)), entrada]);
    setMsg(`${c.rotulo} cadastrado na base. Use “Reverificar” para aplicar.`);
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const j = await importarBase(f);
      onBaseChange(j);
      setMsg(`${j.length} registro(s) importado(s).`);
    } catch {
      setMsg('Arquivo inválido. Use um JSON exportado por este sistema.');
    }
  };

  const partes = [
    `${resumo.confirmadas} confirmadas na base`,
    resumo.alertas ? `${resumo.alertas} com alerta` : '',
    resumo.aConferir ? `${resumo.aConferir} a conferir` : '',
    `${resumo.conferidasPeloUsuario} conferidas por você`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="num text-[15px] text-tinta">
            <span className="font-semibold">{resumo.total} citações</span> extraídas da minuta e do checklist: {partes.join(', ')}.
          </p>
          <p className="mt-1 text-[13px] text-tinta-3">A base local é parcial. O que não constar dela deve ser conferido no portal oficial do tribunal.</p>
        </div>
        <Botao tamanho="sm" onClick={onReverificar} className="shrink-0">
          <RefreshCw className="size-3.5" /> Reverificar
        </Botao>
      </div>

      <div className="flex flex-col gap-3 border-b border-linha lg:flex-row lg:items-end lg:justify-between">
        <Abas
          rotulo="Filtrar citações"
          ativa={filtro}
          onChange={setFiltro}
          itens={[
            { id: 'todos', rotulo: 'Todas', contagem: citacoes.length },
            { id: 'alertas', rotulo: 'Com alerta', contagem: citacoes.filter(ehAlerta).length, alerta: citacoes.some(ehAlerta) },
            { id: 'pendentes', rotulo: 'Pendentes', contagem: citacoes.filter((c) => c.conferencia.situacao === 'pendente').length },
          ]}
        />
        <form onSubmit={adicionar} className="flex flex-wrap items-center gap-1.5 pb-2">
          <select aria-label="Tipo" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as typeof novo.tipo })} className={mini}>
            <option value="sumula">Súmula</option>
            <option value="sumula_vinculante">Súmula vinculante</option>
            <option value="tema">Tema</option>
          </select>
          {novo.tipo !== 'sumula_vinculante' && (
            <select aria-label="Tribunal" value={novo.tribunal} onChange={(e) => setNovo({ ...novo, tribunal: e.target.value as 'STJ' | 'STF' })} className={mini}>
              <option>STJ</option>
              <option>STF</option>
            </select>
          )}
          <input aria-label="Número" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} placeholder="nº" className={`${mini} w-16`} />
          <Botao type="submit" tamanho="sm">
            <Plus className="size-3.5" /> Adicionar
          </Botao>
        </form>
      </div>

      {msg && (
        <p role="status" className="text-sm text-tinta-2">
          {msg}
        </p>
      )}

      {visiveis.length === 0 ? (
        <p className="py-10 text-center text-sm text-tinta-3">Nenhuma citação neste filtro.</p>
      ) : (
        <Folha as="div">
          <ul className="divide-y divide-linha">
            {visiveis.map((c) => {
              const st = STATUS[c.verificacao.status];
              const aberto = abertos[c.id];
              return (
                <li key={c.id} className={`px-5 py-4 sm:px-6 ${c.conferencia.situacao === 'descartado' ? 'opacity-55' : ''}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <button type="button" onClick={() => setAbertos({ ...abertos, [c.id]: !aberto })} aria-expanded={!!aberto} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-serif text-[17px] font-semibold text-tinta">{c.rotulo}</span>
                        <Marca tom={st.tom}>{st.rotulo}</Marca>
                        {c.verificacao.coerencia === 'verificar' && <Marca tom="atencao">Pertinência a verificar</Marca>}
                        {c.manual && <span className="text-[13px] text-tinta-3">adicionada por você</span>}
                      </span>
                      <span className="mt-1 flex items-start gap-2 text-[13px] leading-snug text-tinta-3">
                        <span className="flex-1">{c.verificacao.mensagem}</span>
                        <ChevronDown className={`mt-px size-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <select
                        aria-label={`Conferência de ${c.rotulo}`}
                        value={c.conferencia.situacao}
                        onChange={(e) => atualizar(c.id, { situacao: e.target.value as CitacaoPrecedente['conferencia']['situacao'] })}
                        className={`${mini} pr-7 ${c.conferencia.situacao === 'conferido' ? 'text-ok' : c.conferencia.situacao === 'divergente' ? 'text-obice' : ''}`}
                      >
                        {SITUACOES.map((s) => (
                          <option key={s.v} value={s.v} className="text-tinta">
                            {s.r}
                          </option>
                        ))}
                      </select>
                      <a href={c.linkOficial} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${c.rotulo} no portal oficial`} title="Portal oficial" className="rounded-md p-2 text-tinta-3 hover:bg-papel hover:text-toga">
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-4 grid gap-6 text-sm md:grid-cols-2">
                      <div className="space-y-3">
                        <p className="text-[13px] font-medium text-tinta-2">Onde foi citada</p>
                        {c.ocorrencias.length === 0 && <p className="text-tinta-3">Adicionada manualmente, sem ocorrência no texto.</p>}
                        {c.ocorrencias.map((o, i) => (
                          <blockquote key={i} className="border-l-2 border-linha-forte pl-3">
                            <span className="block text-[12px] text-tinta-3">{o.origem}</span>
                            <span className="font-serif leading-relaxed text-tinta-2">{o.contexto}</span>
                          </blockquote>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {c.verificacao.enunciadoOficial && (
                          <div>
                            <p className="text-[13px] font-medium text-tinta-2">Enunciado na base</p>
                            <p className="mt-1 border-l-2 border-ok pl-3 font-serif leading-relaxed text-tinta">{c.verificacao.enunciadoOficial}</p>
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-[13px] font-medium text-tinta-2" htmlFor={`enc-${c.id}`}>
                            Enunciado conferido no portal
                          </label>
                          <textarea id={`enc-${c.id}`} rows={3} value={c.conferencia.enunciadoConferido ?? ''} onChange={(e) => atualizar(c.id, { enunciadoConferido: e.target.value })} className={campoArea} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[13px] font-medium text-tinta-2" htmlFor={`obs-${c.id}`}>
                            Observação
                          </label>
                          <input id={`obs-${c.id}`} value={c.conferencia.observacao ?? ''} onChange={(e) => atualizar(c.id, { observacao: e.target.value })} className={campo} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.tipo !== 'acordao' && (
                            <>
                              <Botao tamanho="sm" onClick={() => cadastrarNaBase(c, 'vigente')}>
                                Cadastrar como vigente
                              </Botao>
                              <Botao tamanho="sm" variante="discreto" onClick={() => cadastrarNaBase(c, 'cancelada')}>
                                Cadastrar como cancelada
                              </Botao>
                            </>
                          )}
                          {c.manual && (
                            <Botao tamanho="sm" variante="perigo" onClick={() => onChange(citacoes.filter((x) => x.id !== c.id))}>
                              <Trash2 className="size-3.5" /> Remover
                            </Botao>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Folha>
      )}

      <div className="flex flex-wrap items-center gap-1 text-[13px] text-tinta-3">
        <span className="mr-1">Base de precedentes da equipe:</span>
        <Botao tamanho="sm" variante="discreto" onClick={() => exportarBase(baseCustom)} disabled={baseCustom.length === 0}>
          <Download className="size-3.5" /> Exportar ({baseCustom.length})
        </Botao>
        <Botao tamanho="sm" variante="discreto" onClick={() => arquivo.current?.click()}>
          <Upload className="size-3.5" /> Importar
        </Botao>
        <input
          ref={arquivo}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            importar(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
