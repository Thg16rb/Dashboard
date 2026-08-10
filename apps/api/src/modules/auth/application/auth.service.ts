import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CryptoService } from '../../../infra/crypto/crypto.service';
import { MailService } from '../../../infra/mail/mail.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AuthTokens, LoginResult, JwtAccessPayload } from '../domain/auth.types';
import { permissionsForRole } from '../domain/permissions';

/** TTL do token de recuperação de senha (BLUEPRINT — esqueci minha senha). */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

interface RequestMeta {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Cadastro: cria a empresa (tenant), o usuário admin (senha argon2) e o
   * vínculo ADMIN_EMPRESA numa única transação. Emite tokens no fim.
   */
  async signup(
    companyName: string,
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await argon2.hash(password);
    const slugBase = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'empresa';
    const slug = `${slugBase}-${Date.now().toString(36).slice(-4)}`;

    const userId = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: companyName, slug },
      });
      const user = await tx.user.create({
        data: { email, passwordHash },
      });
      await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'ADMIN_EMPRESA' },
      });
      return user.id;
    });

    return this.issueForUser(userId, meta);
  }

  /** Login com email+senha. Se 2FA ligado, retorna challenge; senão, tokens. */
  async login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });

    const ok = user && (await argon2.verify(user.passwordHash, password));
    // registra tentativa (sucesso só depois do 2FA, se houver)
    if (user) {
      await this.prisma.loginHistory.create({
        data: {
          userId: user.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
          success: Boolean(ok),
        },
      });
    }
    if (!user || !ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.is2faEnabled) {
      const challengeToken = this.jwt.sign(
        { sub: user.id, stage: '2fa' },
        {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );
      return { status: 'pending_2fa', challengeToken };
    }

    return this.issueForUser(user.id, meta);
  }

  /** Valida o código TOTP do challenge e emite os tokens. */
  async verify2fa(
    challengeToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    let sub: string;
    try {
      const decoded = this.jwt.verify<{ sub: string; stage: string }>(
        challengeToken,
        { secret: this.config.getOrThrow('JWT_ACCESS_SECRET') },
      );
      if (decoded.stage !== '2fa') throw new Error('stage');
      sub = decoded.sub;
    } catch {
      throw new UnauthorizedException('Challenge inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user?.totpSecretEnc) {
      throw new UnauthorizedException('2FA não configurado');
    }
    const secret = this.crypto.decrypt(Buffer.from(user.totpSecretEnc));
    if (!this.totp.verify(code, secret)) {
      throw new UnauthorizedException('Código 2FA inválido');
    }
    return this.issueForUser(user.id, meta);
  }

  /** Rotação de refresh com detecção de reuso (revoga a família em caso de reuso). */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const hash = this.tokens.hashRefresh(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash },
    });

    if (!session) {
      throw new UnauthorizedException('Refresh inválido');
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      // Reuso de um refresh já revogado/expirado → revoga todas as sessões do usuário
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException('Refresh reutilizado — sessões revogadas');
    }

    // Revoga a sessão atual e emite uma nova (rotação)
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueForUser(session.userId, {
      ...meta,
      deviceFingerprint: session.deviceFingerprint ?? meta.deviceFingerprint,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefresh(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * "Esqueci minha senha": se o e-mail existir, gera um token de reset (guarda
   * só o hash sha256), envia por e-mail e retorna. Resposta é sempre genérica
   * no controller — nunca revela se o e-mail existe (evita enumeração).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // silencioso — não vaza existência do e-mail

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const webUrl = this.config.get('WEB_URL', 'https://dashboard.sistemautomacao.com');
    const resetUrl = `${webUrl}/redefinir-senha?token=${token}`;
    await this.mail.sendPasswordReset(user.email, resetUrl);
  }

  /**
   * Valida o token de reset (hash bate, não expirado, não usado), troca a
   * senha (argon2) e revoga todas as sessões ativas do usuário por segurança.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** Emite access+refresh e persiste a sessão. Usa a primeira membership do usuário. */
  private async issueForUser(
    userId: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
    });
    if (!membership) {
      throw new ForbiddenException('Usuário sem empresa vinculada');
    }

    const payload: JwtAccessPayload = {
      sub: userId,
      tenantId: membership.tenantId,
      role: membership.role,
      perms: permissionsForRole(membership.role),
    };
    const accessToken = this.tokens.signAccess(payload);
    const { token: refreshToken, hash } = this.tokens.generateRefresh();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.tokens.refreshTtlDays());

    await this.prisma.session.create({
      data: {
        userId,
        tenantId: membership.tenantId,
        refreshTokenHash: hash,
        deviceFingerprint: meta.deviceFingerprint,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    return { accessToken, refreshToken };
  }
}
