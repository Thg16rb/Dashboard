import { createHmac } from 'node:crypto';
import { DiggionPayConnector, diggionpayToSale } from './diggionpay.connector';

// Payload real da doc DiggionPay (order.completed) + metadata com UTM/fbclid.
const PAYLOAD = {
  event: 'order.completed',
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  order_id: 456,
  amount: 97.9,
  status: 'completed',
  transaction_id: 'tx-abc123',
  payment_method: 'pix',
  paid_at: '2026-06-13T14:05:12.000000Z',
  email: 'cliente@exemplo.com',
  metadata: {
    external_id: 'ped-1001',
    utm_source: 'facebook',
    utm_campaign: 'lancamento-abril',
    fbclid: 'IwAR_diggion',
  },
  customer: { name: 'Cliente', email: 'cliente@exemplo.com', document: '52998224725' },
};

describe('DiggionPay connector', () => {
  const c = new DiggionPayConnector();

  describe('verifySignature (HMAC-SHA256 hex)', () => {
    const secret = 'webhook_secret_teste';
    const raw = JSON.stringify(PAYLOAD);

    it('aceita assinatura válida em X-Webhook-Signature', () => {
      const sig = createHmac('sha256', secret).update(raw).digest('hex');
      expect(c.verifySignature({ 'x-webhook-signature': sig }, raw, secret)).toBe(true);
    });

    it('rejeita assinatura errada', () => {
      const bad = createHmac('sha256', 'outro').update(raw).digest('hex');
      expect(c.verifySignature({ 'x-webhook-signature': bad }, raw, secret)).toBe(false);
    });

    it('rejeita sem header', () => {
      expect(c.verifySignature({}, raw, secret)).toBe(false);
    });
  });

  describe('diggionpayToSale (order.completed → venda)', () => {
    it('mapeia campos e rastreamento corretamente', () => {
      const sale = diggionpayToSale(PAYLOAD as unknown as Record<string, unknown>);
      expect(sale).not.toBeNull();
      expect(sale!.externalId).toBe('456');
      expect(sale!.grossAmount).toBe(97.9);
      expect(sale!.status).toBe('paid'); // completed → paid
      expect(sale!.paymentMethod).toBe('pix');
      expect(sale!.utm.campaign).toBe('lancamento-abril');
      expect(sale!.clickId).toBe('IwAR_diggion');
      expect(sale!.customerHash).toBeDefined();
      expect(sale!.customerHash).not.toContain('@'); // é hash, não o email
    });

    it('preserva status refunded', () => {
      const sale = diggionpayToSale({ ...PAYLOAD, status: 'refunded' } as Record<string, unknown>);
      expect(sale!.status).toBe('refunded');
    });

    it('ignora payload sem order_id/amount', () => {
      expect(diggionpayToSale({ event: 'order.pending' })).toBeNull();
    });
  });
});
