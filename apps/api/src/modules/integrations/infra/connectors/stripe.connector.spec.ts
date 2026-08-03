import { createHmac } from 'node:crypto';
import { StripeConnector } from './stripe.connector';

describe('StripeConnector HMAC (BLUEPRINT seção 6.1)', () => {
  const connector = new StripeConnector();
  const secret = 'whsec_test';
  const body = '{"id":"evt_1","type":"charge.succeeded"}';

  function sign(b: string, s: string): string {
    return createHmac('sha256', s).update(b).digest('hex');
  }

  it('aceita assinatura válida', () => {
    const sig = sign(body, secret);
    expect(
      connector.verifySignature({ 'stripe-signature': sig }, body, secret),
    ).toBe(true);
  });

  it('rejeita assinatura adulterada', () => {
    const bad = sign(body, 'segredo-errado');
    expect(
      connector.verifySignature({ 'stripe-signature': bad }, body, secret),
    ).toBe(false);
  });

  it('rejeita quando falta o header de assinatura', () => {
    expect(connector.verifySignature({}, body, secret)).toBe(false);
  });

  it('rejeita corpo adulterado com assinatura antiga', () => {
    const sig = sign(body, secret);
    const tampered = body.replace('charge.succeeded', 'charge.refunded');
    expect(
      connector.verifySignature({ 'stripe-signature': sig }, tampered, secret),
    ).toBe(false);
  });
});
