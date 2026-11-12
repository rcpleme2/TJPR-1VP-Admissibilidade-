import React from 'react';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Layers,
  ShieldAlert,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AdmissibilityAnalysisResult } from '../types/admissibility';
import { DeadlinesPanel } from './DeadlinesPanel';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';

interface DashboardOverviewProps {
  data: AdmissibilityAnalysisResult;
  onNavigateToChecklist: () => void;
  onNavigateToMinuta: () => void;
  onDownloadPDF: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  data,
  onNavigateToChecklist,
  onNavigateToMinuta,
  onDownloadPDF,
}) => {
  const { processo, diagnosticoGeral, recursosAnalisados } = data;
  const isMista = diagnosticoGeral.isDecisaoMista;
  const exigeTopico = data.verificacoes?.relevancia.exigeTopicoCalculado ?? processo.exigeTopicoRelevancia;

  return (
    <div className="space-y-6">
      {/* Top Banner: Process Identification */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {processo.classe || 'Recurso aos Tribunais Superiores'}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Autos nº {processo.numero || 'Não informado'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              {processo.materia || 'Matéria em Exame de Admissibilidade'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Baixar Relatório em PDF</span>
            </button>
          </div>
        </div>

        {/* Process Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block mb-0.5">Órgão Julgador de Origem</span>
            <span className="text-slate-800 font-semibold">{processo.origemOrgao || 'TJPR'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block mb-0.5">Data Publicação do Acórdão</span>
            <span className="text-slate-800 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {processo.dataPublicacaoAcordao || 'N/I'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block mb-0.5">Embargos de Declaração</span>
            <span className="text-slate-800 font-semibold">
              {processo.houveEmbargosDeclaracao
                ? `Sim (Publ: ${processo.dataPublicacaoEmbargos || 'Sim'})`
                : 'Não opostos'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-slate-500 block mb-0.5">Valor da Causa / Presunção</span>
            <span className="text-slate-800 font-semibold truncate block" title={processo.valorCausa}>
              {processo.valorCausa || 'Não informado'}
            </span>
          </div>
        </div>
      </div>

      {/* Decision Mista & System Warning Alert */}
      {isMista ? (
        <div className="bg-rose-50/70 border border-rose-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900 px-2 py-0.5 rounded bg-rose-100 border border-rose-200">
                  ALERTA DE DECISÃO MISTA (CPC, ART. 1.030)
                </span>
                <span className="text-xs text-rose-800 font-medium">Erro Grosseiro em caso de recurso único</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-rose-950 mt-1">
                {diagnosticoGeral.recursoCabivelAdvertencia}
              </p>
              <p className="text-xs text-rose-900/90 mt-1.5 leading-relaxed">
                Segundo a jurisprudência do STJ e do STF (confira os precedentes na aba "Precedentes"), a
                interposição de um único recurso contra decisão mista configura erro grosseiro e{' '}
                <strong>não admite fungibilidade</strong>. A decisão da 1ª Vice-Presidência deve conter capítulos
                estanques com expressa advertência ao recorrente.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Sistema Recursal Aplicável
            </span>
            <p className="text-xs text-slate-700 mt-0.5">
              {diagnosticoGeral.recursoCabivelAdvertencia}
            </p>
          </div>
        </div>
      )}

      {/* 4 Scorecards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Probabilidade */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Diagnóstico Global</span>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-900 leading-snug">
            {diagnosticoGeral.probabilidadeAdmissao}
          </p>
          <div className="mt-2 text-[11px] text-slate-500">
            Classificação preliminar da assessoria
          </div>
        </div>

        {/* Card 2: Enquadramento CPC */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Enquadramento Art. 1.030</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-900 leading-snug">
            {diagnosticoGeral.incisoArt1030Principal}
          </p>
          <div className="mt-2 text-[11px] text-slate-500">
            {isMista ? 'Múltiplos incisos aplicados' : 'Inciso único determinante'}
          </div>
        </div>

        {/* Card 3: Relevância 2026 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Tópico de Relevância (2026)</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <p
            className={`text-sm font-bold leading-snug ${
              exigeTopico ? 'text-amber-900' : 'text-slate-600'
            }`}
          >
            {exigeTopico ? 'Obrigatório (Lei 15.484)' : `Facultativo (antes de ${MARCO_RELEVANCIA_BR})`}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 truncate" title={processo.marcoTemporalRelevancia2026}>
            {processo.marcoTemporalRelevancia2026}
          </div>
        </div>

        {/* Card 4: Óbices Detectados */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Óbices Detectados</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-sm font-bold text-rose-800">
            {(diagnosticoGeral.principaisObicesIdentificados ?? []).length} barreiras identificadas
          </p>
          <div className="mt-2 text-[11px] text-slate-500">
            Súmulas e teses vinculantes impeditivas
          </div>
        </div>
      </div>

      {data.verificacoes && <DeadlinesPanel v={data.verificacoes} />}

      {/* Main Content: Resumo & Óbices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Parecer Resumido */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Parecer Técnico Conclusivo da 1ª Vice-Presidência
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            {diagnosticoGeral.resumoParecer}
          </p>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={onNavigateToChecklist}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
            >
              <span>Ver Checklist Detalhado (A a J)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onNavigateToMinuta}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 transition shadow-xs"
            >
              <span>Examinar Minuta da Decisão</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Right: Óbices & Recursos Analisados */}
        <div className="lg:col-span-5 space-y-4">
          {/* Óbices Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
              Óbices e Precedentes Identificados
            </h4>

            {(diagnosticoGeral.principaisObicesIdentificados ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum óbice intransponível detectado.</p>
            ) : (
              <div className="space-y-2">
                {(diagnosticoGeral.principaisObicesIdentificados ?? []).map((obice, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                    <span>{obice}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recursos Analisados Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              Recursos Submetidos a Exame ({recursosAnalisados.length})
            </h4>

            <div className="space-y-2">
              {recursosAnalisados.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{rec.tipo}</span>
                    <span className="text-[11px] text-slate-600 font-mono">
                      {(rec.alineasConstitucionais || []).join(', ') || 'Alíneas'}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">Recorrente: {rec.recorrente}</p>
                  {rec.dispositivosInvocados && rec.dispositivosInvocados.length > 0 && (
                    <p className="text-slate-500 text-[11px] truncate" title={rec.dispositivosInvocados.join('; ')}>
                      Artigos: {rec.dispositivosInvocados.join('; ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
