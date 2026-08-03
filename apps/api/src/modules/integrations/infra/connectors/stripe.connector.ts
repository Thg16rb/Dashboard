import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  IntegrationConnector,
  DecryptedCredential,
  SyncContext,
  SyncBatch,
  ValidationResult,
  NormalizedEvent,
} from '../../domain/connector';

/**
 * Connector Stripe (gateway) — BLUEPRINT seção 4.2.
 * Inclui verificação HMAC de webhook em tempo constante (seção 6.1).
 */
@Injectable()
export class StripeConnector implements IntegrationConnector {
  readonly code = 'stripe';
  readonly category = 'gateway' as const;
  readonly authType = 'api_key' as const;

  async validateCredentials(cred: DecryptedCredential): Promise<ValidationResult> {
    if (!cred.secretKey) {
      return { valid: false, message: 'secretKey é obrigatória' };
    }
    return { valid: true };
  }

  async fetch(_ctx: SyncContext, _cred: DecryptedCredential): Promise<SyncBatch> {
    // Placeholder estrutural: listagem de charges/payments entra no Passo 5.
    return { records: [], hasMore: false };
  }

  verifySignature(
    headers: Record<string, string | undefined>,
    rawBody: string,
    secret: string,
  ): boolean {
    const sig = headers['stripe-signature'];
    if (!sig) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEvent(payload: unknown): NormalizedEvent {
    const p = payload as { id?: string; type?: string; data?: unknown };
    return {
      eventType: p.type ?? 'unknown',
      externalId: p.id ?? '',
      data: (p.data as Record<string, unknown>) ?? {},
    };
  }
}
