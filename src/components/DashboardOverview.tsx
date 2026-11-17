import React from 'react';
import { AdmissibilityAnalysisResult, EntradasPrazo } from '../types/admissibility';
import { DeadlinesPanel } from './DeadlinesPanel';
import { PreparoPanel } from './PreparoPanel';
import { obterPreparo } from '../../shared/preparo';
import type { PreparoItem } from '../../shared/schema';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';
import { Folha, Marca, TituloSecao } from './ui';
import { obterSobrestamento, ROTULO_CONCLUSAO } from '../../shared/sobrestamento';
import { resultadoAdmissibilidade, ROTULO_RESULTADO } from '../../shared/resultado';
import type { FundamentoRecurso, MinutaDecisao1VP } from '../../shared/schema';
import { DecisionDraftView } from './DecisionDraftView';

interface DashboardOverviewProps {
  data: AdmissibilityAnalysisResult;
  onChangePrazo: (e: EntradasPrazo) => void;
  onNavigateToChecklist: () => void;
  onNavigateToSobrestamento: () => void;
  onChangePreparo: (p: PreparoItem[]) => void;
  onChangeMinuta: (m: MinutaDecisao1VP) => void;
  onDownloadPDF: () => void;
  onDownloadWord: () => void;
}

/** Fundamentos do recurso: os da IA ou, em análises antigas, os permissivos de cada recurso, sem conclusão. */
function fundamentos(data: AdmissibilityAnalysisResult): Array<Omit<FundamentoRecurso, 'conclusao'> & { conclusao?: FundamentoRecurso['conclusao'] }> {
  if (data.fundamentosRecurso?.length) return data.fundamentosRecurso;
  return data.recursosAnalisados.flatMap((r) =>
    (r.alineasConstitucionais?.length ? r.alineasConstitucionais : ['Permissivo não identificado']).map((al) => ({
      recurso: /extraord|\bRE\b/i.test(r.tipo) ? ('RE' as const) : ('REsp' as const),
      permissivo: al,
      alegacao: (r.dispositivosInvocados ?? []).join('; '),
      fundamentacao: '',
    })),
  );
}

const FundamentosTabela: React.FC<{ data: AdmissibilityAnalysisResult; onRequisitos: () => void }> = ({ data, onRequisitos }) => {
  const linhas = fundamentos(data);
  const semConclusao = !data.fundamentosRecurso?.length;
  return (
    <section aria-labelledby="fund-titulo" className="mt-8 border-t border-linha pt-6">
      <TituloSecao as="h3" id="fund-titulo" className="!text-[17px]">
        Fundamentos do recurso
      </TituloSecao>
      <p className="mt-1 text-[13px] text-tinta-3">Cada permissivo invocado e por que é acolhido ou rejeitado no juízo de admissibilidade.</p>
      <table className="mt-4 w-full border-collapse text-left text-sm">
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-linha-forte text-[12px] text-tinta-3">
            <th scope="col" className="w-[30%] py-2 pr-4 font-normal">Fundamento</th>
            <th scope="col" className="w-[7.5rem] py-2 pr-4 font-normal">Conclusão</th>
            <th scope="col" className="py-2 font-normal">Fundamentação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((f, i) => (
            <tr key={i} className="block border-b border-linha py-3 align-top md:table-row md:py-0">
              <td className="block md:table-cell md:py-3 md:pr-4">
                <span className="text-[12px] font-medium text-tinta-3">{f.recurso === 'RE' ? 'Recurso extraordinário' : 'Recurso especial'}</span>
                <span className="block font-medium text-tinta">{f.permissivo}</span>
                {f.alegacao && <span className="mt-0.5 block text-[13px] leading-snug text-tinta-2">{f.alegacao}</span>}
              </td>
              <td className="mt-1.5 block md:mt-0 md:table-cell md:py-3 md:pr-4">
                {f.conclusao ? (
                  <Marca tom={f.conclusao === 'acolhido' ? 'ok' : 'obice'}>{f.conclusao === 'acolhido' ? 'Acolhido' : 'Rejeitado'}</Marca>
                ) : (
                  <span className="text-[13px] text-tinta-3">—</span>
                )}
              </td>
              <td className="mt-1 block font-serif text-[15px] leading-relaxed text-tinta md:mt-0 md:table-cell md:py-3">{f.fundamentacao || <span className="font-sans text-[13px] text-tinta-3">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {semConclusao && <p className="mt-3 text-[13px] text-tinta-3">Esta análise é anterior ao quadro de fundamentos: a conclusão de cada um está nos requisitos.</p>}
      <button type="button" onClick={onRequisitos} className="mt-4 text-[13px] font-medium text-toga underline-offset-2 hover:underline">
        Conferir os requisitos
      </button>
    </section>
  );
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ data, onChangePrazo, onNavigateToChecklist, onNavigateToSobrestamento, onChangePreparo, onChangeMinuta, onDownloadPDF, onDownloadWord }) => {
  const { processo, diagnosticoGeral, recursosAnalisados } = data;
  const exigeTopico = data.verificacoes?.relevancia.exigeTopicoCalculado ?? processo.exigeTopicoRelevancia;
  const obices = diagnosticoGeral.principaisObicesIdentificados ?? [];
  const sob = obterSobrestamento(data);
  const resultado = resultadoAdmissibilidade(data);

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
              {sob.automatica && sob.conclusao !== 'nao_verificado' && <p className="mt-0.5 text-[13px] text-tinta-3">Marcada pelo sistema: nenhum tema indicado justifica o sobrestamento.</p>}
              {sob.conclusao === 'sobrestar' && (
                <p className="mt-1 text-[13px] text-tinta-2">O exame de admissibilidade da matéria afetada fica suspenso até o julgamento do tema.</p>
              )}
            </div>
            <button type="button" onClick={onNavigateToSobrestamento} className="shrink-0 text-[13px] font-medium text-toga underline-offset-2 hover:underline">
              {sob.conclusao === 'nao_verificado' ? 'Examinar' : 'Rever'}
            </button>
          </div>

          <p className="mt-6 text-[13px] text-tinta-3">Admissibilidade</p>
          <p className={`mt-1.5 font-serif text-[26px] font-semibold leading-snug tracking-[-0.01em] ${resultado === 'negar_seguimento' ? 'text-obice' : 'text-ok'}`}>{ROTULO_RESULTADO[resultado]}</p>

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


          <FundamentosTabela data={data} onRequisitos={onNavigateToChecklist} />
        </Folha>

        {data.verificacoes && <DeadlinesPanel v={data.verificacoes} entradas={data.entradasPrazo} onChange={onChangePrazo} />}
        <PreparoPanel itens={obterPreparo(data)} onChange={onChangePreparo} />

        <Folha aria-labelledby="minuta-titulo" className="p-6 sm:p-8" id="minuta">
          <TituloSecao id="minuta-titulo">Proposta de minuta</TituloSecao>
          <p className="mt-1 mb-5 text-[13px] text-tinta-3">Relatório, fundamentação e dispositivo. O cabeçalho e a assinatura entram no PDF e no Word.</p>
          <DecisionDraftView minuta={data.minutaDecisao1VP} onChange={onChangeMinuta} onDownloadPDF={onDownloadPDF} onDownloadWord={onDownloadWord} somenteTexto />
        </Folha>
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
