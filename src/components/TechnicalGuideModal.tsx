import React, { useState } from 'react';
import { LINHA_TEMPO_2026, TABELA_ART_1030, SUMULAS_MAIS_FREQUENTES } from '../data/technicalGuidelines';
import { MARCO_RELEVANCIA_BR } from '../../shared/regras';
import { Abas, Modal } from './ui';

interface TechnicalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Aba = 'saidas' | 'relevancia' | 'sumulas' | 'rotina';

const Regra: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <li className="py-4">
    <p className="font-medium text-tinta">{titulo}</p>
    <p className="mt-1 leading-relaxed text-tinta-2">{children}</p>
  </li>
);

export const TechnicalGuideModal: React.FC<TechnicalGuideModalProps> = ({ isOpen, onClose }) => {
  const [aba, setAba] = useState<Aba>('saidas');
  if (!isOpen) return null;

  return (
    <Modal
      titulo="Orientações técnicas"
      subtitulo="Admissibilidade de REsp e RE na 1ª Vice-Presidência, atualizadas pela Lei 15.484/2026"
      onClose={onClose}
      largura="max-w-3xl"
      cabecalhoExtra={
        <Abas
          rotulo="Seções do guia"
          ativa={aba}
          onChange={setAba}
          className="mt-3"
          itens={[
            { id: 'saidas', rotulo: 'Art. 1.030' },
            { id: 'relevancia', rotulo: 'Relevância' },
            { id: 'sumulas', rotulo: 'Súmulas frequentes' },
            { id: 'rotina', rotulo: 'Competência' },
          ]}
        />
      }
    >
      <div className="text-sm">
        {aba === 'saidas' && (
          <>
            <p className="max-w-[65ch] text-tinta-2">
              O recurso cabível depende do inciso em que a decisão se apoia, não do rótulo usado. Em decisão mista, é obrigatória a interposição de ambos os recursos.
            </p>
            <ul className="mt-4 divide-y divide-linha border-t border-linha">
              {TABELA_ART_1030.map((s, i) => (
                <li key={i} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[7rem_1fr]">
                  <p className="font-serif text-[17px] font-semibold text-toga">Inciso {s.inciso}</p>
                  <div>
                    <p className="text-tinta">{s.quando}</p>
                    <p className="mt-1 text-[13px] text-tinta-2">
                      <span className="text-tinta-3">Cabe:</span> {s.recurso}
                    </p>
                    {s.observacoes && <p className="mt-1 text-[13px] text-tinta-3">{s.observacoes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {aba === 'relevancia' && (
          <>
            <ul className="divide-y divide-linha">
              <Regra titulo="Tópico próprio obrigatório">
                O recorrente deve demonstrar a relevância econômica, política, social ou jurídica em tópico específico e fundamentado (CPC, art. 1.035-A; RISTJ, art. 255-B, § 1º).
                Desatendida a forma, o recurso é inadmitido na origem (art. 255-B, § 2º).
              </Regra>
              <Regra titulo="A presunção não dispensa o tópico">
                Nas hipóteses do art. 105, § 3º, da CF (ações penais, improbidade, causa acima de 500 salários mínimos, inelegibilidade, acórdão contrário à jurisprudência
                dominante do STJ), a relevância é presumida, mas o recorrente precisa demonstrar no tópico que o caso se enquadra (RISTJ, arts. 255-J e 255-K).
              </Regra>
              <Regra titulo="Marco temporal">
                A exigência vale para recurso contra acórdão publicado a partir de {MARCO_RELEVANCIA_BR} (Lei 15.484/2026, art. 4º). Decide a data da publicação, não a da interposição.
              </Regra>
              <Regra titulo="Quem decide a irrelevância">
                Somente o STJ, por 2/3 do órgão competente. A Vice-Presidência verifica a existência formal e fundamentada do tópico e aplica temas já decididos (art. 1.030, I, c).
              </Regra>
              <Regra titulo="Novo art. 1.030, I, c, do CPC">
                Nega-se seguimento ao REsp sobre questão cuja relevância o STJ não reconheceu, ou contra acórdão conforme o entendimento firmado nesse regime. Cabe agravo
                interno (§ 2º), não o agravo do art. 1.042.
              </Regra>
            </ul>

            <h3 className="mt-6 border-b border-linha pb-2 font-serif text-[17px] font-semibold text-tinta">Marcos de 2026</h3>
            <dl className="divide-y divide-linha">
              {LINHA_TEMPO_2026.map((m, i) => (
                <div key={i} className="grid gap-x-6 py-3 sm:grid-cols-[7rem_1fr]">
                  <dt className="num text-[13px] font-medium text-tinta-2">{m.data}</dt>
                  <dd>
                    <span className="text-tinta">{m.marco}</span>
                    <span className="mt-0.5 block text-[13px] text-tinta-3">{m.efeito}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {aba === 'sumulas' && (
          <ul className="divide-y divide-linha">
            {SUMULAS_MAIS_FREQUENTES.map((s, i) => (
              <li key={i} className="py-4">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-serif text-[17px] font-semibold text-tinta">{s.numero}</span>
                  <span className="text-[13px] text-tinta-3">{s.aplicacao}</span>
                </p>
                <p className="mt-1 text-tinta">{s.tema}</p>
                <p className="mt-1 text-[13px] text-tinta-2">{s.usoPratico}</p>
              </li>
            ))}
          </ul>
        )}

        {aba === 'rotina' && (
          <div className="max-w-[65ch] space-y-6 leading-relaxed text-tinta-2">
            <p>
              O 1º Vice-Presidente exerce o juízo de admissibilidade de REsp e RE por delegação do Presidente, com base no art. 15, § 3º, do Regimento Interno, no Decreto
              Judiciário 024-DM/2017 e na Resolução 175/2016 do Órgão Especial. Compete-lhe ainda:
            </p>
            <ul className="space-y-2 pl-4 [list-style:'–__']">
              <li>incidentes como a suspensão por repetitivos e medidas cautelares;</li>
              <li>tutelas de urgência com efeito suspensivo em recursos aos tribunais superiores (RITJPR, arts. 107-A e 107-B; CPC, art. 1.029, § 5º);</li>
              <li>dúvidas de competência entre câmaras cíveis e criminais (art. 197, §§ 9º e 10).</li>
            </ul>
            <div>
              <h3 className="font-serif text-[17px] font-semibold text-tinta">Custas do REsp</h3>
              <p className="mt-1">
                Hoje, R$ 270,12 fixos. A partir de 1º/1/2027, 2% do valor atualizado da causa, com mínimo de R$ 1.325,45 e máximo de R$ 107.332,80 (Lei 15.498/2026).
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
