import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EXTENSAO_CHROME_IDS } from '../server/config';
import { ziparPasta, zipar } from '../server/zip';

const manifest = JSON.parse(readFileSync('extensao-chrome/manifest.json', 'utf8'));

/** ID de extensão do Chrome derivado da chave pública: sha256 → 32 primeiros dígitos hex mapeados em a–p. */
const idDaChave = (b64: string) =>
  [...createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

describe('extensão do Chrome', () => {
  it('o ID fixado pela chave do manifest é o liberado no servidor', () => {
    expect(EXTENSAO_CHROME_IDS).toContain(idDaChave(manifest.key));
  });

  it('manifest MV3 com painel lateral, sem permissões amplas na instalação', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.side_panel.default_path).toBe('painel.html');
    expect(manifest.host_permissions).toEqual(['https://*.jus.br/*']);
    expect(manifest.permissions).toEqual(['sidePanel', 'storage']);
  });

  it('o .zip traz os arquivos da extensão íntegros', () => {
    const zip = ziparPasta('extensao-chrome', 'extensao-admissibilidade');
    const fim = zip.length - 22;
    expect(zip.readUInt32LE(fim)).toBe(0x06054b50);
    const nomes: string[] = [];
    let p = zip.readUInt32LE(fim + 16);
    for (let i = 0; i < zip.readUInt16LE(fim + 10); i++) {
      const n = zip.readUInt16LE(p + 28);
      nomes.push(zip.subarray(p + 46, p + 46 + n).toString('utf8'));
      p += 46 + n + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
    }
    expect(nomes).toContain('extensao-admissibilidade/manifest.json');
    expect(nomes).toContain('extensao-admissibilidade/painel.js');
    expect(nomes.some((n) => n.includes('/.'))).toBe(false);
  });

  it('zipar preserva o conteúdo', () => {
    const z = zipar([{ nome: 'a/ção.txt', dados: Buffer.from('conteúdo de teste') }]);
    const n = z.readUInt16LE(26);
    const tam = z.readUInt32LE(18);
    expect(z.subarray(30, 30 + n).toString('utf8')).toBe('a/ção.txt');
    expect(inflateRawSync(z.subarray(30 + n, 30 + n + tam)).toString()).toBe('conteúdo de teste');
  });
});
