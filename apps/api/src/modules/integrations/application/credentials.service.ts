import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CryptoService } from '../../../infra/crypto/crypto.service';
import { DecryptedCredential } from '../domain/connector';

/**
 * Persistência de credenciais criptografadas (BLUEPRINT seções 4/9).
 * As credenciais nunca ficam em texto puro; só são decriptadas em memória no
 * momento do uso (sync/validação).
 */
@Injectable()
export class CredentialsService {
  private static readonly KEY_VERSION = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async upsert(
    integrationId: string,
    cred: DecryptedCredential,
  ): Promise<void> {
    const payload = this.crypto.encrypt(JSON.stringify(cred));
    // Formato do CryptoService: iv(12) + tag(16) + ciphertext
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);

    await this.prisma.integrationCredential.upsert({
      where: { integrationId },
      create: {
        integrationId,
        ciphertext,
        iv,
        authTag,
        keyVersion: CredentialsService.KEY_VERSION,
      },
      update: {
        ciphertext,
        iv,
        authTag,
        keyVersion: CredentialsService.KEY_VERSION,
        rotatedAt: new Date(),
      },
    });
  }

  async get(integrationId: string): Promise<DecryptedCredential | null> {
    const row = await this.prisma.integrationCredential.findUnique({
      where: { integrationId },
    });
    if (!row) return null;
    const payload = Buffer.concat([
      Buffer.from(row.iv),
      Buffer.from(row.authTag),
      Buffer.from(row.ciphertext),
    ]);
    return JSON.parse(this.crypto.decrypt(payload)) as DecryptedCredential;
  }
}
