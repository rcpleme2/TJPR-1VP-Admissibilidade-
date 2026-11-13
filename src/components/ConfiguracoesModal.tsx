import React, { useState } from 'react';
import { Abas, Botao, campoArea, Modal } from './ui';

interface Props {
  onClose: () => void;
  onEsquecerChaves: () => void;
  motor: React.ReactNode;
  instrucoes: string;
  instrucoesPadrao?: string;
  onInstrucoes: (t: string) => void;
}

export const ConfiguracoesModal: React.FC<Props> = ({ onClose, onEsquecerChaves, motor, instrucoes, instrucoesPadrao, onInstrucoes }) => {
  const [aba, setAba] = useState<'motor' | 'instrucoes'>('motor');
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
          ]}
        />
      }
      rodape={
        <>
          {aba === 'motor' ? (
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
      {aba === 'motor' ? (
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
