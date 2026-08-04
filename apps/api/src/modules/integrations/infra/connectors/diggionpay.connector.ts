import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import {
  IntegrationConnector,
  DecryptedCredential,
  SyncContext,
  SyncBatch,
  ValidationResult,
  NormalizedEvent,
} from '../../domain/connector';

/**
 * Connector DiggionPay (gateway PIX) — https://diggionpay.com.br/docs/api-pagamentos
 *
 * Webhook: header X-Webhook-Signature = HMAC-SHA256(bodyBruto, webhook_secret) em hex.
 * Evento de venda paga: event="order.completed", status="completed".
 * Rastreamento (UTM/click id) vem dentro de `metadata`.
 */
@Injectable()
export class DiggionPayConnector implements IntegrationConnector {
  readonly code = 'diggionpay';
  readonly category = 'gateway' as const;
  readonly authType = 'api_key' as const;

  async validateCredentials(cred: DecryptedCredential): Promise<ValidationResult> {
    // Public+Secret key para chamar a API; webhookSecret para validar entregas.
    if (!cred.publicKey || !cred.secretKey) {
      return { valid: false, message: 'publicKey e secretKey são obrigatórias' };
    }
    return { valid: true };
  }

  async fetch(_ctx: SyncContext, _cred: DecryptedCredential): Promise<SyncBatch> {
    // Reconciliação via GET /payments pode entrar depois; o fluxo principal é webhook.
    return { records: [], hasMore: false };
  }

  /**
   * Valida a assinatura HMAC-SHA256 do body bruto (BLUEPRINT seção 6.1).
   * secret = webhook_secret retornado pela DiggionPay no provisionamento.
   */
  verifySignature(
    headers: Record<string, string | undefined>,
    rawBody: string,
    secret: string,
  ): boolean {
    const received = headers['x-webhook-signature'];
    if (!received) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Converte o payload do webhook DiggionPay em evento normalizado (venda). */
  parseEvent(payload: unknown): NormalizedEvent {
    const p = payload as {
      event?: string;
      event_id?: string;
      order_id?: number | string;
      transaction_id?: string;
      amount?: number;
      status?: string;
      payment_method?: string;
      email?: string;
      paid_at?: string;
      metadata?: Record<string, unknown>;
      customer?: { email?: string; document?: string };
    };
    return {
      eventType: p.event ?? 'unknown',
      externalId: String(p.order_id ?? p.transaction_id ?? p.event_id ?? ''),
      data: p as Record<string, unknown>,
    };
  }
}

/**
 * Normaliza o payload DiggionPay em venda interna (usado pelo webhook controller).
 * Exportado para reuso/teste.
 */
export function diggionpayToSale(p: Record<string, unknown>) {
  const md = (p.metadata as Record<string, unknown>) ?? {};
  const num = (v: unknown) => {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

  const externalId = str(p.order_id) ?? String(p.order_id ?? '') ?? str(p.transaction_id);
  const amount = num(p.amount);
  if (!externalId || amount <= 0) return null;

  // status: completed=pago; refunded/cancelled preservados
  const rawStatus = str(p.status) ?? 'unknown';
  const status = rawStatus === 'completed' ? 'paid' : rawStatus;

  const email = str(p.email) ?? str((p.customer as { email?: string })?.email);

  return {
    externalId: String(externalId),
    grossAmount: amount,
    feeAmount: num(p.fee_amount), // DiggionPay não envia taxa no order.completed; fica 0
    status,
    paymentMethod: str(p.payment_method),
    customerHash: email
      ? createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32)
      : undefined,
    utm: {
      source: str(md.utm_source),
      medium: str(md.utm_medium),
      campaign: str(md.utm_campaign),
      content: str(md.utm_content),
      term: str(md.utm_term),
    },
    clickId: str(md.fbclid ?? md.gclid ?? md.ttclid ?? md.click_id),
    occurredAt: p.paid_at ? new Date(String(p.paid_at)) : new Date(),
    provider: 'diggionpay',
  };
}
