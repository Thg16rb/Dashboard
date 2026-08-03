import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

/**
 * TOTP (2FA) — geração de segredo, otpauth URI/QR e verificação (BLUEPRINT 3.3).
 * O segredo é criptografado (AES) antes de persistir em users.totp_secret_enc
 * pelo AuthService; este serviço lida apenas com a lógica TOTP.
 */
@Injectable()
export class TotpService {
  constructor(private readonly config: ConfigService) {}

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  verify(code: string, secret: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  async buildQrDataUrl(email: string, secret: string): Promise<string> {
    const issuer = this.config.get('TOTP_ISSUER', 'Dashboard');
    const otpauth = authenticator.keyuri(email, issuer, secret);
    return QRCode.toDataURL(otpauth);
  }
}
