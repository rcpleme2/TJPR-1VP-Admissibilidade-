import type { Provedor } from '../../shared/schema';
import { claude } from './claude';
import { gemini } from './gemini';
import { gpt } from './gpt';
import type { Provedorlike } from './types';

export const PROVEDORES_IMPL: Record<Provedor, Provedorlike> = { gemini, claude, gpt };
