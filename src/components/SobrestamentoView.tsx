import React, { useState } from 'react';
import { ChevronDown, ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { ConclusaoSobrestamento, Sobrestamento, TemaSobrestamento } from '../../shared/schema';
import {
  conclusaoSugerida,
  linkTema,
  novoTemaManual,
  ROTULO_CONCLUSAO,
  ROTULO_ENQUADRAMENTO,
  ROTULO_ESPECIE,
  ROTULO_SITUACAO_TEMA,
  ROTULO_SUSPENSAO,
  rotuloTema,
} from '../../shared/sobrestamento';
import { Botao, campo, campoArea, dataHora, Folha, Marca, type Tom } from './ui';

interface Props {
  valor: Sobrestamento;
  avisos: string[];
  usuarioNome?: string;
  onChange: (s: Sobrestamento) => void;
}

const TOM_CONCLUSAO: Record<ConclusaoSobrestamento, Tom> = { nao_verificado: 'neutro', sobrestar: 'atencao', tema_sem_suspensao: 'ok', nao_ha_tema: 'ok' };
const TOM_SUSPENSAO: Record<TemaSobrestamento['suspensao'], Tom> = { determinada: 'atencao', nao_determinada: 'neutro', a_conferir: 'neutro' };
const TOM_ENQUADRAMENTO: Record<TemaSobrestamento['enquadramento'], Tom> = { se_insere: 'atencao', nao_se_insere: 'neutro', a_verificar: 'neutro' };

const mini = 'h-8 rounded-md border border-linha-forte bg-folha pl-2 pr-7 text-[13px] text-tinta focus:border-toga focus:outline-none';

function Escolha<T extends string>({ id, rotulo, valor, opcoes, onChange }: { id: string; rotulo: string; valor: T; opcoes: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] text-tinta-3">
        {rotulo}
      </label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value as T)} className={`${mini} w-full`}>
        {(Object.keys(opcoes) as T[]).map((k) => (
          <option key={k} value={k}>
            {opcoes[k]}
          </option>
        ))}
      </select>
    </div>
  );
}

export const SobrestamentoView: React.FC<Props> = ({ valor, avisos, usuarioNome, onChange }) => {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [novo, setNovo] = useState<{ tribunal: 'STJ' | 'STF'; especie: TemaSobrestamento['especie']; numero: string }>({ tribunal: 'STJ', especie: 'repetitivo', numero: '' });
  const sugerida = conclusaoSugerida(valor);

  const set = (p: Partial<Sobrestamento>) => onChange({ ...valor, ...p });
  const setTema = (id: string, p: Partial<TemaSobrestamento>) => set({ temas: valor.temas.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const concluir = (c: ConclusaoSobrestamento) =>
    set({ conclusao: c, verificadoPor: c === 'nao_verificado' ? undefined : usuarioNome, verificadoEm: c === 'nao_verificado' ? undefined : new Date().toISOString() });

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = novoTemaManual(novo.tribunal, novo.especie, novo.numero, valor.temas);
    set({ temas: [...valor.temas, t] });
    setAbertos({ ...abertos, [t.id]: true });
    setNovo({ ...novo, numero: '' });
  };

  return (
    <Folha aria-labelledby="sob-titulo">
      <div className="flex flex-col gap-1 border-b border-linha px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
        <h3 id="sob-titulo" className="font-serif text-[18px] font-semibold leading-tight text-tinta">
          Preliminar: sobrestamento
        </h3>
        <p className="text-[13px] text-tinta-3">CPC, arts. 1.030, III, e 1.037, II</p>
      </div>

      <div className="space-y-8 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[13px] text-tinta-3">A matéria se insere em tema afetado com ordem de suspensão e mérito pendente?</p>
          <div role="radiogroup" aria-label="Conclusão sobre o sobrestamento" className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.keys(ROTULO_CONCLUSAO) as ConclusaoSobrestamento[]).map((c) => {
              const ativa = valor.conclusao === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  onClick={() => concluir(c)}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    ativa ? 'border-toga bg-toga-claro font-medium text-toga' : 'border-linha-forte bg-folha text-tinta-2 hover:border-tinta-3'
                  }`}
                >
                  {ROTULO_CONCLUSAO[c]}
                  {sugerida === c && !ativa && <span className="shrink-0 text-[12px] font-normal text-tinta-3">sugerida</span>}
                </button>
              );
            })}
          </div>
          {valor.verificadoPor && valor.verificadoEm && valor.conclusao !== 'nao_verificado' && (
            <p className="num mt-3 text-[13px] text-tinta-3">
              Registrado por {valor.verificadoPor} em {dataHora(valor.verificadoEm)}.
            </p>
          )}

          <div className="mt-6">
            <label htmlFor="sob-fund" className="mb-1.5 block text-[13px] font-medium text-tinta-2">
              Fundamentação
            </label>
            <textarea
              id="sob-fund"
              rows={3}
              value={valor.fundamentacao ?? ''}
              onChange={(e) => set({ fundamentacao: e.target.value })}
              placeholder="Ex.: a controvérsia sobre a cobrança da tarifa foi afetada no Tema X, com suspensão nacional determinada em dd/mm/aaaa."
              className={campoArea}
            />
          </div>

          {avisos.length > 0 && (
            <div className="mt-6 space-y-1.5">
              {avisos.map((a, i) => (
                <p key={i} className="flex gap-2.5 text-sm text-tinta-2">
                  <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-[1.5px] bg-atencao" />
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>

        <section aria-labelledby="temas-titulo">
          <div className="flex flex-col gap-3 border-b border-linha pb-3 lg:flex-row lg:items-end lg:justify-between">
            <h4 id="temas-titulo" className="text-sm font-semibold text-tinta">
              Temas examinados
            </h4>
            <form onSubmit={adicionar} className="flex flex-wrap items-center gap-1.5">
              <select aria-label="Tribunal" value={novo.tribunal} onChange={(e) => setNovo({ ...novo, tribunal: e.target.value as 'STJ' | 'STF', especie: e.target.value === 'STF' ? 'repercussao_geral' : 'repetitivo' })} className={mini}>
                <option>STJ</option>
                <option>STF</option>
              </select>
              <select aria-label="Espécie" value={novo.especie} onChange={(e) => setNovo({ ...novo, especie: e.target.value as TemaSobrestamento['especie'] })} className={mini}>
                {novo.tribunal === 'STJ' ? (
                  <>
                    <option value="repetitivo">Repetitivo</option>
                    <option value="relevancia">Relevância</option>
                  </>
                ) : (
                  <option value="repercussao_geral">Repercussão geral</option>
                )}
              </select>
              <input aria-label="Número do tema" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} placeholder="nº" className="h-8 w-16 rounded-md border border-linha-forte bg-folha px-2 text-[13px] focus:border-toga focus:outline-none" />
              <Botao type="submit" tamanho="sm">
                <Plus className="size-3.5" /> Adicionar tema
              </Botao>
            </form>
          </div>

          {valor.temas.length === 0 ? (
            <p className="py-6 text-sm text-tinta-3">
              Nenhum tema indicado. Pesquise a questão de direito nos{' '}
              <a href={linkTema({ tribunal: 'STJ', numero: '' })} target="_blank" rel="noopener noreferrer" className="text-toga underline underline-offset-2">
                repetitivos do STJ
              </a>{' '}
              e na{' '}
              <a href={linkTema({ tribunal: 'STF', numero: '' })} target="_blank" rel="noopener noreferrer" className="text-toga underline underline-offset-2">
                repercussão geral do STF
              </a>{' '}
              e registre aqui o que encontrar.
            </p>
          ) : (
            <ul className="divide-y divide-linha">
              {valor.temas.map((t) => {
                const aberto = abertos[t.id];
                return (
                  <li key={t.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setAbertos({ ...abertos, [t.id]: !aberto })} aria-expanded={!!aberto} className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-serif text-[17px] font-semibold text-tinta">{rotuloTema(t)}</span>
                          <span className="text-[13px] text-tinta-3">
                            {ROTULO_ESPECIE[t.especie]}
                            {t.origem === 'ia' ? ', indicado pela IA' : ''}
                          </span>
                        </span>
                        {t.questao && <span className="mt-1 block text-sm leading-snug text-tinta-2">{t.questao}</span>}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <Marca tom={TOM_ENQUADRAMENTO[t.enquadramento]}>{ROTULO_ENQUADRAMENTO[t.enquadramento]}</Marca>
                          <Marca tom={TOM_SUSPENSAO[t.suspensao]}>{ROTULO_SUSPENSAO[t.suspensao]}</Marca>
                          <span className="text-[13px] text-tinta-3">{ROTULO_SITUACAO_TEMA[t.situacao]}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <a href={linkTema(t)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${rotuloTema(t)} no portal oficial`} title="Portal oficial" className="rounded-md p-2 text-tinta-3 hover:bg-tinta/[0.05] hover:text-toga">
                          <ExternalLink className="size-4" />
                        </a>
                        <button type="button" onClick={() => setAbertos({ ...abertos, [t.id]: !aberto })} aria-label={aberto ? 'Recolher' : 'Expandir'} className="rounded-md p-2 text-tinta-3 hover:bg-tinta/[0.05] hover:text-tinta">
                          <ChevronDown className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {aberto && (
                      <div className="mt-4 space-y-4 border-l-2 border-linha pl-4">
                        {t.pertinencia && (
                          <p className="text-[13px] leading-relaxed text-tinta-2">
                            <span className="text-tinta-3">Pertinência apontada: </span>
                            {t.pertinencia}
                          </p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Escolha id={`enq-${t.id}`} rotulo="Enquadramento" valor={t.enquadramento} opcoes={ROTULO_ENQUADRAMENTO} onChange={(v) => setTema(t.id, { enquadramento: v })} />
                          <Escolha id={`sus-${t.id}`} rotulo="Suspensão" valor={t.suspensao} opcoes={ROTULO_SUSPENSAO} onChange={(v) => setTema(t.id, { suspensao: v })} />
                          <Escolha id={`sit-${t.id}`} rotulo="Mérito do tema" valor={t.situacao} opcoes={ROTULO_SITUACAO_TEMA} onChange={(v) => setTema(t.id, { situacao: v })} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
                          <div>
                            <label htmlFor={`num-${t.id}`} className="mb-1 block text-[13px] text-tinta-3">
                              Número
                            </label>
                            <input id={`num-${t.id}`} value={t.numero} onChange={(e) => setTema(t.id, { numero: e.target.value })} className={`${campo} num h-8 text-[13px]`} />
                          </div>
                          <div>
                            <label htmlFor={`q-${t.id}`} className="mb-1 block text-[13px] text-tinta-3">
                              Questão submetida a julgamento
                            </label>
                            <input id={`q-${t.id}`} value={t.questao} onChange={(e) => setTema(t.id, { questao: e.target.value })} className={`${campo} h-8 text-[13px]`} />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`af-${t.id}`} className="mb-1 block text-[13px] text-tinta-3">
                              Decisão de afetação ou suspensão
                            </label>
                            <input id={`af-${t.id}`} value={t.decisaoAfetacao ?? ''} onChange={(e) => setTema(t.id, { decisaoAfetacao: e.target.value })} placeholder="ProAfR no REsp nº, DJe de" className={`${campo} h-8 text-[13px]`} />
                          </div>
                          <div>
                            <label htmlFor={`ab-${t.id}`} className="mb-1 block text-[13px] text-tinta-3">
                              Abrangência da suspensão
                            </label>
                            <input id={`ab-${t.id}`} value={t.abrangencia ?? ''} onChange={(e) => setTema(t.id, { abrangencia: e.target.value })} placeholder="Nacional; só REsp e AREsp; etc." className={`${campo} h-8 text-[13px]`} />
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`obs-${t.id}`} className="mb-1 block text-[13px] text-tinta-3">
                            Observação
                          </label>
                          <input id={`obs-${t.id}`} value={t.observacao ?? ''} onChange={(e) => setTema(t.id, { observacao: e.target.value })} className={`${campo} h-8 text-[13px]`} />
                        </div>
                        <Botao tamanho="sm" variante="perigo" onClick={() => set({ temas: valor.temas.filter((x) => x.id !== t.id) })}>
                          <Trash2 className="size-3.5" /> Remover tema
                        </Botao>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-[13px] leading-relaxed text-tinta-3">
          Os temas indicados pela IA são ponto de partida: confira número, questão e situação no portal oficial. Tema já julgado não sobresta; aplica-se a tese (art. 1.030, I ou II).
        </p>
      </div>
    </Folha>
  );
};
