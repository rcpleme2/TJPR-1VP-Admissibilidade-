import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Abas, Botao, botao, campoArea, Modal } from './ui';
import { URL_EXTENSAO, VERSAO_EXTENSAO } from '../lib/extensao';

interface Props {
  onClose: () => void;
  onEsquecerChaves: () => void;
  motor: React.ReactNode;
  instrucoes: string;
  instrucoesPadrao?: string;
  onInstrucoes: (t: string) => void;
}

export const ConfiguracoesModal: React.FC<Props> = ({ onClose, onEsquecerChaves, motor, instrucoes, instrucoesPadrao, onInstrucoes }) => {
  const [aba, setAba] = useState<'motor' | 'instrucoes' | 'extensao'>('motor');
  const personalizado = Boolean(instrucoes.trim()) && instrucoes.trim() !== (instrucoesPadrao ?? '').trim();
  const texto = instrucoes || instrucoesPadrao || '';

  return (
    <Modal
      titulo="Configurações"
      subtitulo="Valem para as análises feitas neste navegador."
      onClose={onClose}
      largura={aba === 'instrucoes' ? 'max-w-4xl' : 'max-w-lg'}
      cabecalhoExtra={
        <Abas
          rotulo="Seções das configurações"
          ativa={aba}
          onChange={setAba}
          className="mt-3"
          itens={[
            { id: 'motor', rotulo: 'Motor de IA' },
            { id: 'instrucoes', rotulo: personalizado ? 'Instruções (personalizadas)' : 'Instruções' },
            { id: 'extensao', rotulo: 'Extensão do Chrome' },
          ]}
        />
      }
      rodape={
        <>
          {aba === 'extensao' ? null : aba === 'motor' ? (
            <Botao variante="discreto" onClick={onEsquecerChaves} className="mr-auto">
              Esquecer as chaves salvas
            </Botao>
          ) : (
            <Botao variante="discreto" onClick={() => onInstrucoes('')} disabled={!personalizado} className="mr-auto">
              Restaurar o padrão
            </Botao>
          )}
          <Botao variante="primario" onClick={onClose}>
            Concluir
          </Botao>
        </>
      }
    >
      {aba === 'extensao' ? (
        <div className="space-y-5 text-sm text-tinta-2">
          <p>Abre este sistema no painel lateral do Chrome, ao lado do Projudi. No painel, você pode arrastar os documentos direto do site do processo, sem baixá-los antes.</p>
          <a href={URL_EXTENSAO} download className={botao('primario')}>
            <Download className="size-4" />
            Baixar a extensão{VERSAO_EXTENSAO ? `, versão ${VERSAO_EXTENSAO}` : ''}
          </a>
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-tinta-3">
            <li>Descompacte o arquivo baixado numa pasta fixa.</li>
            <li>
              No Chrome, abra <span className="font-medium text-tinta">chrome://extensions</span> e ligue o <span className="font-medium text-tinta">Modo do desenvolvedor</span>.
            </li>
            <li>
              Clique em <span className="font-medium text-tinta">Carregar sem compactação</span> e escolha a pasta.
            </li>
            <li>
              Clique no ícone da extensão e informe o endereço <span className="num font-medium text-tinta">{window.location.origin}</span>.
            </li>
          </ol>
          <p className="text-[13px] text-tinta-3">Para atualizar, baixe de novo, substitua o conteúdo da pasta e clique em Recarregar na página de extensões. Os sites do Judiciário (*.jus.br) já vêm liberados para arrastar documentos; outros sites podem ser liberados nas opções da extensão.</p>
        </div>
      ) : aba === 'motor' ? (
        motor
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] leading-snug text-tinta-2">
            Instruções enviadas à IA em cada análise. As alterações valem para as próximas análises. As regras de proteção contra ordens escritas nos autos são sempre aplicadas e não aparecem aqui.
          </p>
          <label htmlFor="instrucoes" className="sr-only">
            Instruções da análise
          </label>
          <textarea
            id="instrucoes"
            value={texto}
            onChange={(e) => onInstrucoes(e.target.value === instrucoesPadrao ? '' : e.target.value)}
            rows={22}
            spellCheck={false}
            className={`${campoArea} resize-y text-[13px] leading-relaxed`}
          />
          <p className="num text-[13px] text-tinta-3">
            {personalizado ? 'Personalizadas.' : 'Padrão do sistema.'} {texto.length.toLocaleString('pt-BR')} de 40.000 caracteres.
          </p>
        </div>
      )}
    </Modal>
  );
};
