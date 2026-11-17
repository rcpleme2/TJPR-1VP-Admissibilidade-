// Gera dist/extensao-admissibilidade.zip a partir de extensao-chrome/ (rodado no build).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NOME_ZIP_EXTENSAO, ziparPasta } from '../server/zip';

const raiz = path.resolve(import.meta.dirname, '..');
const zip = ziparPasta(path.join(raiz, 'extensao-chrome'), 'extensao-admissibilidade');
mkdirSync(path.join(raiz, 'dist'), { recursive: true });
writeFileSync(path.join(raiz, 'dist', NOME_ZIP_EXTENSAO), zip);
console.log(`${NOME_ZIP_EXTENSAO}: ${(zip.length / 1024).toFixed(0)} KB`);
