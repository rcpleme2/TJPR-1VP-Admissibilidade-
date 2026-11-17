import { describe, expect, it } from 'vitest';
import { baixarLink, ipInterno, validarUrl } from '../server/baixarLink';

describe('download de links pelo servidor (sem a extensão)', () => {
  it('reconhece endereços internos', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])
      expect(ipInterno(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '200.144.0.1', '2001:4860:4860::8888']) expect(ipInterno(ip), ip).toBe(false);
  });

  it('só aceita https público, sem credenciais nem porta diferente', () => {
    expect(validarUrl('https://projudi.tjpr.jus.br/doc.pdf').hostname).toBe('projudi.tjpr.jus.br');
    for (const u of ['http://exemplo.com/a.pdf', 'https://user:x@exemplo.com/', 'https://exemplo.com:8443/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://metadata.google.internal/', 'ftp://x/'])
      expect(() => validarUrl(u), u).toThrow();
  });

  it('recusa nome que resolve para endereço interno', async () => {
    await expect(baixarLink('https://localtest.me/a.pdf')).rejects.toThrow();
  });
});
