import React from 'react';
import { Botao, Modal } from './ui';

export const ConfiguracoesModal: React.FC<{ onClose: () => void; onEsquecerChaves: () => void; children: React.ReactNode }> = ({ onClose, onEsquecerChaves, children }) => (
  <Modal
    titulo="Configurações"
    subtitulo="Motor de IA usado nas análises. Vale só para este navegador."
    onClose={onClose}
    rodape={
      <>
        <Botao variante="discreto" onClick={onEsquecerChaves} className="mr-auto">
          Esquecer as chaves salvas
        </Botao>
        <Botao variante="primario" onClick={onClose}>
          Concluir
        </Botao>
      </>
    }
  >
    {children}
  </Modal>
);
