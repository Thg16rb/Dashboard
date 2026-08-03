import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { JwtAccessPayload } from '../domain/auth.types';

/**
 * Emissão e verificação de tokens (BLUEPRINT seção 3.3).
 * - Access JWT curto (15 min) com claims de autorização.
 * - Refresh opaco (não-JWT): valor aleatório; só o hash é persistido em `sessions`.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(payload: JwtAccessPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
    });
  }

  verifyAccess(token: string): JwtAccessPayload {
    return this.jwt.verify<JwtAccessPayload>(token, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }

  /** Gera um refresh token opaco e seu hash (o que vai ao banco). */
  generateRefresh(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefresh(token) };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshTtlDays(): number {
    return Number(this.config.get('JWT_REFRESH_TTL_DAYS', 30));
  }
}
