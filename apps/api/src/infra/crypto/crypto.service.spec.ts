import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function makeService(): CryptoService {
  const config = {
    get: (_k: string, def?: string) => def ?? 'chave-de-teste-fixa',
  } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService AES-256-GCM (BLUEPRINT seção 9)', () => {
  it('encrypt→decrypt recupera o texto original', () => {
    const svc = makeService();
    const secret = 'accessToken=abc123;adAccountId=act_999';
    const enc = svc.encrypt(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('ciphertext difere do plaintext (não vaza)', () => {
    const svc = makeService();
    const enc = svc.encrypt('senha-super-secreta');
    expect(enc.toString('utf8')).not.toContain('senha-super-secreta');
  });

  it('rejeita payload adulterado (authTag GCM)', () => {
    const svc = makeService();
    const enc = svc.encrypt('dado-integro');
    enc[enc.length - 1] ^= 0xff; // corrompe o último byte
    expect(() => svc.decrypt(enc)).toThrow();
  });
});
