/**
 * Tipos do domínio de autenticação (BLUEPRINT seção 3.3).
 */

export interface JwtAccessPayload {
  sub: string; // user id
  tenantId: string;
  role: string;
  perms: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Resultado do login quando 2FA está habilitado: exige segundo fator. */
export interface Pending2fa {
  status: 'pending_2fa';
  challengeToken: string;
}

export type LoginResult = AuthTokens | Pending2fa;
