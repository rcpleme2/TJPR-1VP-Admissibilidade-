import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { STATUS_CASO, validarCNJ, type StatusCaso } from '../../shared/registro';
import type { AdmissibilityAnalysisResult } from '../types/admissibility';
import { Botao, dataHora } from './ui';

export type EstadoSalvamento = 'exemplo' | 'novo' | 'salvando' | 'salvo' | 'erro' | 'conflito' | 'numero_invalido';

export const ROTULO_STATUS: Record<StatusCaso, string> = { em_analise: 'Em análise', revisado: 'Revisado', concluido: 'Concluído' };

interface Props {
  dados: AdmissibilityAnalysisResult;
  estado: EstadoSalvamento;
  onNumero: (n: string) => void;
  versao?: number;
  atualizadoPor?: string;
  atualizadoEm?: string;
  status: StatusCaso;
  onStatus: (s: StatusCaso) => void;
  mensagem?: string;
  onRetry: () => void;
  onHistorico: () => void;
  conflito?: { versao: number; por: string; em: string };
  onCarregarNuvem: () => void;
  onSobrescrever: () => void;
}

export const CasoCabecalho: React.FC<Props> = (p) => {
  const { processo, meta } = p.dados;
  const [numero, setNumero] = useState(processo.numero);
  useEffect(() => setNumero(processo.numero), [processo.numero]);
  const cnj = validarCNJ(numero);
  const exemplo = p.estado === 'exemplo';

  const salvamento = {
    exemplo: <span>Caso de exemplo, não é gravado</span>,
    novo: <span>Ainda não gravado</span>,
    salvando: (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin" /> Gravando
      </span>
    ),
    salvo: (
      <span className="num">
        Gravado{p.versao ? `, versão ${p.versao}` : ''}
        {p.atualizadoPor ? `, por ${p.atualizadoPor}` : ''}
        {p.atualizadoEm ? ` em ${dataHora(p.atualizadoEm)}` : ''}
      </span>
    ),
    erro: (
      <span className="text-obice">
        {p.mensagem || 'Não foi possível gravar.'}{' '}
        <button type="button" onClick={p.onRetry} className="font-medium underline underline-offset-2">
          Tentar de novo
        </button>
      </span>
    ),
    conflito: <span className="text-atencao">Conflito de edição</span>,
    numero_invalido: <span className="text-atencao">{p.mensagem || 'Corrija o número do processo para gravar.'}</span>,
  }[p.estado];

  const dados: Array<[string, string]> = [
    ['Órgão julgador', processo.origemOrgao || 'Não identificado'],
    ['Publicação do acórdão', processo.dataPublicacaoAcordao || 'Não identificada'],
    ['Embargos de declaração', processo.houveEmbargosDeclaracao ? `Opostos${processo.dataPublicacaoEmbargos ? `, publicados em ${processo.dataPublicacaoEmbargos}` : ''}` : 'Não opostos'],
    ['Valor da causa', processo.valorCausa || 'Não informado'],
  ];

  const origem =
    meta && meta.provedor !== 'exemplo'
      ? `Rascunho gerado por ${meta.provedor === 'gpt' ? 'GPT' : meta.provedor[0]!.toUpperCase() + meta.provedor.slice(1)} (${meta.modelo}) em ${dataHora(meta.geradoEm)}.`
      : meta?.provedor === 'exemplo'
        ? 'Caso simulado para demonstração.'
        : 'Rascunho gerado com IA.';

  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[13px] text-tinta-3">{processo.classe || 'Recurso aos tribunais superiores'}</p>
          <h1 className="mt-1.5 font-serif text-[30px] font-semibold leading-[1.15] tracking-[-0.015em] text-tinta sm:text-[34px]">
            {processo.materia || 'Matéria não identificada'}
          </h1>
          <div className="mt-3">
            <label htmlFor="num-proc" className="sr-only">
              Número do processo
            </label>
            <input
              id="num-proc"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              onBlur={() => numero !== processo.numero && p.onNumero(numero.trim())}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              aria-invalid={!cnj.valido}
              placeholder="Número do processo"
              title="Clique para corrigir o número"
              className={`num -ml-2 h-8 w-[19rem] max-w-full rounded-md border bg-transparent px-2 text-[15px] text-tinta-2 transition-colors hover:border-linha-forte focus:border-toga focus:bg-folha focus:outline-none ${
                cnj.valido ? 'border-transparent' : 'border-atencao/60'
              }`}
            />
            {!cnj.valido && !exemplo && <p className="mt-1 text-[13px] text-atencao">{cnj.motivo}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <div className="flex items-center gap-2">
            <label htmlFor="situacao" className="sr-only">
              Situação
            </label>
            <select
              id="situacao"
              value={p.status}
              onChange={(e) => p.onStatus(e.target.value as StatusCaso)}
              disabled={exemplo}
              className="h-8 rounded-md border border-linha-forte bg-folha pl-2.5 pr-7 text-[13px] font-medium text-tinta focus:border-toga focus:outline-none disabled:opacity-50"
            >
              {STATUS_CASO.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </option>
              ))}
            </select>
            <Botao tamanho="sm" variante="discreto" onClick={p.onHistorico} disabled={exemplo || p.estado === 'novo'}>
              <History className="size-4" /> Histórico
            </Botao>
          </div>
          <p role="status" aria-live="polite" className="text-[13px] text-tinta-3">
            {salvamento}
          </p>
        </div>
      </div>

      {p.estado === 'conflito' && p.conflito && (
        <div role="alert" className="space-y-3 border-l-2 border-atencao pl-4">
          <p className="text-sm text-tinta-2">
            <strong className="font-semibold text-tinta">{p.conflito.por}</strong> gravou a versão {p.conflito.versao} em {dataHora(p.conflito.em)}, depois que você abriu
            este registro. Suas alterações ainda não foram gravadas; nenhuma versão se perde.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao tamanho="sm" onClick={p.onCarregarNuvem}>
              Carregar a versão gravada
            </Botao>
            <Botao tamanho="sm" variante="primario" onClick={p.onSobrescrever}>
              Gravar a minha por cima
            </Botao>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-linha py-4 lg:grid-cols-4">
        {dados.map(([t, d]) => (
          <div key={t} className="min-w-0">
            <dt className="text-[13px] text-tinta-3">{t}</dt>
            <dd className="num mt-0.5 truncate text-sm text-tinta" title={d}>
              {d}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-[13px] text-tinta-3">{origem} A IA pode errar fatos, datas e citações: confira os autos, os prazos e os precedentes antes de usar.</p>
    </header>
  );
};
