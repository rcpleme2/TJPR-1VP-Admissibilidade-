import React, { useEffect, useState } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Layers,
  Scale,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  LINHA_TEMPO_2026,
  TABELA_ART_1030,
  SUMULAS_MAIS_FREQUENTES,
} from '../data/technicalGuidelines';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';

interface TechnicalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechnicalGuideModal: React.FC<TechnicalGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'saidas' | 'relevancia' | 'sumulas' | 'rotina'>('saidas');

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="guia-titulo" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-200/80 text-slate-800">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 id="guia-titulo" className="text-base font-bold text-slate-900">
                Orientações Técnicas da 1ª Vice-Presidência (TJPR)
              </h3>
              <p className="text-xs text-slate-500">
                Estudo de Admissibilidade Recursal atualizado em Novembro/2026 (Lei 15.484/2026)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-white shrink-0 gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('saidas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'saidas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Art. 1.030 do CPC (5 Saídas)
          </button>

          <button
            onClick={() => setActiveTab('relevancia')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'relevancia'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Relevância 2026 (Lei 15.484)
          </button>

          <button
            onClick={() => setActiveTab('sumulas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'sumulas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Súmulas Mais Frequentes
          </button>

          <button
            onClick={() => setActiveTab('rotina')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'rotina'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Competência & Rotina da 1VP
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {activeTab === 'saidas' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <strong>Atenção ao Cabimento:</strong> O recurso cabível contra a decisão depende do inciso em que ela
                se apoia, não do rótulo usado ("inadmitido" ou "nega-se seguimento"). Se houver decisão mista, é
                obrigatória a interposição de ambos os recursos.
              </div>

              <div className="space-y-3">
                {TABELA_ART_1030.map((saida, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">Inciso {saida.inciso}</span>
                      <span className="px-2 py-0.5 rounded bg-white text-slate-800 text-[11px] font-semibold border border-slate-300">
                        {saida.recurso}
                      </span>
                    </div>
                    <p className="text-slate-800">{saida.quando}</p>
                    <p className="text-slate-500 text-[11px] italic">Observação: {saida.observacoes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'relevancia' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Regras Cruciais da Relevância que a Vice-Presidência precisa dominar:
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-700">
                  <li>
                    <strong>Tópico próprio obrigatório:</strong> O recorrente deve demonstrar a relevância econômica,
                    política, social ou jurídica da questão em tópico específico e fundamentado (art. 1.035-A do CPC; art.
                    255-B, § 1º, do RISTJ). Desatendida a forma, o recurso é inadmitido na origem (art. 255-B, § 2º).
                  </li>
                  <li>
                    <strong>A presunção NÃO dispensa o tópico:</strong> Nas hipóteses do art. 105, § 3º, da CF (ações
                    penais, improbidade, causa acima de 500 salários mínimos, inelegibilidade, acórdão contrário à
                    jurisprudência dominante do STJ) a relevância é presumida por lei, mas o recorrente ainda precisa
                    demonstrar, expressamente no tópico, que o caso se enquadra (arts. 255-J e 255-K do RISTJ).
                  </li>
                  <li>
                    <strong>Marco temporal:</strong> A exigência vale para recurso contra acórdão <strong>publicado a
                    partir de {MARCO_RELEVANCIA_BR}</strong> (art. 4º da Lei 15.484/2026). Não é a data da interposição que decide!
                  </li>
                  <li>
                    <strong>Quem decide a irrelevância:</strong> Apenas o STJ, por 2/3 do órgão competente, rejeita a
                    relevância (art. 1.035-A, caput). A 1ª Vice-Presidência de origem verifica a existência formal e
                    fundamentada do tópico e aplica temas já decididos (art. 1.030, I, "c").
                  </li>
                  <li>
                    <strong>Novo art. 1.030, I, "c", do CPC:</strong> A Vice-Presidência nega seguimento ao REsp que
                    discuta questão cuja relevância o STJ não reconheceu, ou interposto contra acórdão conforme o
                    entendimento firmado nesse regime. Cabe agravo interno (§ 2º), NÃO cabe agravo do art. 1.042.
                  </li>
                </ul>
              </div>

              {/* Timeline Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h5 className="font-bold text-slate-900 mb-2">Linha do Tempo dos Marcos Legais (2026)</h5>
                <div className="divide-y divide-slate-200">
                  {LINHA_TEMPO_2026.map((m, idx) => (
                    <div key={idx} className="py-2 flex items-start justify-between gap-4">
                      <div>
                        <span className="font-semibold text-slate-800 block">{m.marco}</span>
                        <span className="text-[11px] text-slate-500">{m.efeito}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-600 shrink-0 font-bold">{m.data}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sumulas' && (
            <div className="space-y-3">
              <p className="text-slate-500">
                Súmulas de maior incidência no juízo prévio de admissibilidade de Recursos Especiais e Extraordinários:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUMULAS_MAIS_FREQUENTES.map((s, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{s.numero}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                        {s.aplicacao}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 text-xs">{s.tema}</p>
                    <p className="text-[11px] text-slate-500 italic">Aplicação prática: {s.usoPratico}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rotina' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Estrutura e Competência da 1ª Vice-Presidência do TJPR</h4>
                <p className="leading-relaxed">
                  O 1º Vice-Presidente exerce o juízo de admissibilidade de REsp e RE por delegação do Presidente, com
                  base no <strong>art. 15, § 3º, do Regimento Interno (RITJPR)</strong>, no Decreto Judiciário
                  024-DM/2017 e na Resolução 175/2016 do Órgão Especial.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>Juízo de Admissibilidade de REsp e RE;</li>
                  <li>Incidentes como suspensão por repetitivos e medidas cautelares;</li>
                  <li>Tutelas de urgência com efeito suspensivo em recursos aos tribunais superiores (arts. 107-A e 107-B do RITJPR e art. 1.029, § 5º, do CPC);</li>
                  <li>Dúvidas e exames de competência entre câmaras cíveis e criminais (art. 197, §§ 9º e 10).</li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h5 className="font-bold text-slate-900">Custas do REsp (Tabela Vigente)</h5>
                <p className="text-slate-700">
                  Custas do REsp hoje: <strong>R$ 270,12 fixos</strong>. A partir de 1º/1/2027, 2% do valor atualizado
                  da causa (mínimo R$ 1.325,45 e máximo R$ 107.332,80), conforme a Lei 15.498/2026.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
          >
            Fechar Guia
          </button>
        </div>
      </div>
    </div>
  );
};
