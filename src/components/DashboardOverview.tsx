import React from 'react';
import { AdmissibilityAnalysisResult, EntradasPrazo } from '../types/admissibility';
import { DeadlinesPanel } from './DeadlinesPanel';
import { PreparoPanel } from './PreparoPanel';
import { obterPreparo } from '../../shared/preparo';
import type { PreparoItem } from '../../shared/schema';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';
import { Botao, Folha, TituloSecao } from './ui';
import { obterSobrestamento, ROTULO_CONCLUSAO } from '../../shared/sobrestamento';

interface DashboardOverviewProps {
  data: AdmissibilityAnalysisResult;
  onChangePrazo: (e: EntradasPrazo) => void;
  onNavigateToChecklist: () => void;
  onNavigateToMinuta: () => void;
  onNavigateToSobrestamento: () => void;
  onChangePreparo: (p: PreparoItem[]) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ data, onChangePrazo, onNavigateToChecklist, onNavigateToMinuta, onNavigateToSobrestamento, onChangePreparo }) => {
  const { processo, diagnosticoGeral, recursosAnalisados } = data;
  const exigeTopico = data.verificacoes?.relevancia.exigeTopicoCalculado ?? processo.exigeTopicoRelevancia;
  const obices = diagnosticoGeral.principaisObicesIdentificados ?? [];
  const sob = obterSobrestamento(data);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-8">
        <Folha className="p-6 sm:p-8">
          <div className="flex flex-col gap-2 border-b border-linha pb-5 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-[13px] text-tinta-3">Preliminar: sobrestamento</p>
              <p className={`mt-0.5 text-[15px] ${sob.conclusao === 'sobrestar' ? 'font-medium text-atencao' : sob.conclusao === 'nao_verificado' ? 'text-atencao' : 'text-tinta'}`}>
                {sob.conclusao === 'nao_verificado'
                  ? sob.temas.length
                    ? `Não verificado; ${sob.temas.length === 1 ? '1 tema indicado' : `${sob.temas.length} temas indicados`}`
                    : 'Não verificado'
                  : ROTULO_CONCLUSAO[sob.conclusao]}
              </p>
              {sob.conclusao === 'sobrestar' && (
                <p className="mt-1 text-[13px] text-tinta-2">O exame de admissibilidade da matéria afetada fica suspenso até o julgamento do tema.</p>
              )}
            </div>
            <button type="button" onClick={onNavigateToSobrestamento} className="shrink-0 text-[13px] font-medium text-toga underline-offset-2 hover:underline">
              {sob.conclusao === 'nao_verificado' ? 'Examinar' : 'Rever'}
            </button>
          </div>

          <p className="mt-6 text-[13px] text-tinta-3">Admissibilidade</p>
          <p className="mt-1.5 font-serif text-[24px] font-semibold leading-snug tracking-[-0.01em] text-tinta">{diagnosticoGeral.probabilidadeAdmissao}</p>

          <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-[13px] text-tinta-3">Art. 1.030 do CPC</dt>
              <dd className="mt-0.5 text-sm text-tinta">{diagnosticoGeral.incisoArt1030Principal}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-tinta-3">Tópico de relevância</dt>
              <dd className="mt-0.5 text-sm text-tinta" title={processo.marcoTemporalRelevancia2026}>
                {exigeTopico ? 'Exigido (Lei 15.484/2026)' : `Não exigido, acórdão anterior a ${MARCO_RELEVANCIA_BR}`}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-tinta-3">Óbices</dt>
              <dd className={`num mt-0.5 text-sm ${obices.length ? 'font-medium text-obice' : 'text-tinta'}`}>
                {obices.length === 0 ? 'Nenhum identificado' : obices.length === 1 ? '1 identificado' : `${obices.length} identificados`}
              </dd>
            </div>
          </dl>


          <div className="mt-8 border-t border-linha pt-6">
            <TituloSecao as="h3" className="!text-[17px]">
              Parecer
            </TituloSecao>
            <p className="mt-3 max-w-[68ch] whitespace-pre-line font-serif text-[16px] leading-[1.7] text-tinta">{diagnosticoGeral.resumoParecer}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Botao variante="primario" onClick={onNavigateToMinuta}>
                Revisar a minuta
              </Botao>
              <Botao onClick={onNavigateToChecklist}>Conferir os requisitos</Botao>
            </div>
          </div>
        </Folha>

        {data.verificacoes && <DeadlinesPanel v={data.verificacoes} entradas={data.entradasPrazo} onChange={onChangePrazo} />}
        <PreparoPanel itens={obterPreparo(data)} onChange={onChangePreparo} />
      </div>

      <aside className="space-y-8">
        <section aria-labelledby="obices-titulo">
          <h3 id="obices-titulo" className="border-b border-linha pb-2 text-sm font-semibold text-tinta">
            Óbices e precedentes
          </h3>
          {obices.length === 0 ? (
            <p className="pt-3 text-sm text-tinta-3">Nenhum óbice identificado.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {obices.map((o, i) => (
                <li key={i} className="flex gap-2.5 py-3 text-sm leading-snug text-tinta-2">
                  <span aria-hidden className="mt-[7px] size-[6px] shrink-0 rounded-[1.5px] bg-obice" />
                  {o}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recursos-titulo">
          <h3 id="recursos-titulo" className="flex items-baseline justify-between border-b border-linha pb-2 text-sm font-semibold text-tinta">
            Recursos em exame <span className="num font-normal text-tinta-3">{recursosAnalisados.length}</span>
          </h3>
          <ul className="divide-y divide-linha">
            {recursosAnalisados.map((rec) => (
              <li key={rec.id} className="space-y-1 py-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-tinta">{rec.tipo}</span>
                  {(rec.alineasConstitucionais || []).length > 0 && <span className="text-[13px] text-tinta-3">{rec.alineasConstitucionais!.join(', ')}</span>}
                </p>
                <p className="text-[13px] text-tinta-2">{rec.recorrente}</p>
                {rec.dispositivosInvocados && rec.dispositivosInvocados.length > 0 && (
                  <p className="text-[13px] leading-snug text-tinta-3">{rec.dispositivosInvocados.join('; ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
};
