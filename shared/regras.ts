/**
 * Regras de negócio com data/valor numéricos, em um único lugar.
 * Usadas pelo prompt (servidor), pelo cálculo de prazos e pela UI.
 */

/** Vigência da Lei 15.484/2026 e da Emenda Regimental STJ 55/2026 (relevância da questão federal). */
export const MARCO_RELEVANCIA_ISO = '2026-09-03';
export const MARCO_RELEVANCIA_BR = '03/09/2026';

/** Prazo comum dos recursos (REsp/RE/agravos), em dias úteis (CPC, arts. 219 e 1.003, § 5º). */
export const PRAZO_RECURSAL_DIAS_UTEIS = 15;

/** Faixas conhecidas para detectar números inexistentes de súmulas. */
export const FAIXAS_SUMULAS = {
  /** Última súmula conhecida do STJ na data de elaboração da base + margem de segurança. */
  STJ: { max: 720, exata: false },
  /** O STF encerrou a numeração ordinária na Súmula 736. */
  STF: { max: 736, exata: true },
  /** Súmulas vinculantes: margem sobre as já editadas. */
  SV: { max: 75, exata: false },
} as const;
