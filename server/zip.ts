import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

/** ZIP mínimo (deflate), sem dependências: usado para entregar a extensão do Chrome. */

const TABELA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = TABELA[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipar(arquivos: Array<{ nome: string; dados: Buffer }>, data = new Date()): Buffer {
  const hora = (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2);
  const dia = ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let pos = 0;
  for (const { nome, dados } of arquivos) {
    const n = Buffer.from(nome, 'utf8');
    const comp = deflateRawSync(dados, { level: 9 });
    const crc = crc32(dados);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    h.writeUInt16LE(8, 8);
    h.writeUInt16LE(hora, 10);
    h.writeUInt16LE(dia, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18);
    h.writeUInt32LE(dados.length, 22);
    h.writeUInt16LE(n.length, 26);
    locais.push(h, n, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(dia, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(dados.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(pos, 42);
    centrais.push(c, n);
    pos += h.length + n.length + comp.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...locais, dir, fim]);
}

/** Compacta a pasta inteira, dentro de uma pasta-raiz com o nome dado. */
export function ziparPasta(pasta: string, raiz: string): Buffer {
  const arquivos: Array<{ nome: string; dados: Buffer }> = [];
  const percorrer = (dir: string, rel: string) => {
    for (const nome of readdirSync(dir).sort()) {
      if (nome.startsWith('.')) continue;
      const abs = path.join(dir, nome);
      if (statSync(abs).isDirectory()) percorrer(abs, `${rel}${nome}/`);
      else arquivos.push({ nome: `${raiz}/${rel}${nome}`, dados: readFileSync(abs) });
    }
  };
  percorrer(pasta, '');
  return zipar(arquivos);
}

export const NOME_ZIP_EXTENSAO = 'extensao-admissibilidade.zip';
