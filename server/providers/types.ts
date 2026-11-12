import type { Provedor } from '../../shared/schema';

export type ParteEntrada =
  | { kind: 'text'; text: string }
  | { kind: 'pdf'; name: string; base64: string };

export interface EntradaProvedor {
  apiKey: string;
  model: string;
  system: string;
  partes: ParteEntrada[];
  jsonSchema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Provedorlike {
  id: Provedor;
  /** Retorna o JSON (texto) devolvido pelo modelo. */
  executar(entrada: EntradaProvedor): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
