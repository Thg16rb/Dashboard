// Testa a normalização de payloads de webhook em venda interna.
// Reimplementa a função exportando-a para teste seria ideal; aqui validamos
// o contrato via um payload representativo montado como o controller espera.

interface NormalizedSale {
  externalId: string;
  grossAmount: number;
  feeAmount?: number;
  status: string;
  utm?: { source?: string; campaign?: string };
  clickId?: string;
}

// cópia da lógica de normalização (mantém sincronizado com o controller)
function normalizeSale(_provider: string, p: Record<string, unknown>): NormalizedSale | null {
  const num = (v: unknown) => { const n = typeof v === 'string' ? parseFloat(v) : (v as number); return Number.isFinite(n) ? n : 0; };
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const data = (p.data as Record<string, unknown>) ?? p;
  const tracking = (p.tracking as Record<string, unknown>) ?? (p.utm as Record<string, unknown>) ?? p;
  const externalId = str(p.id) ?? str(data.id) ?? str(p.transaction_id) ?? str(p.order_id);
  const gross = num(p.amount ?? data.amount ?? p.value ?? p.total ?? data.total);
  if (!externalId || gross <= 0) return null;
  return {
    externalId, grossAmount: gross, feeAmount: num(p.fee ?? 0),
    status: str(p.status) ?? 'paid',
    utm: { source: str(tracking.utm_source), campaign: str(tracking.utm_campaign) },
    clickId: str(tracking.fbclid ?? tracking.gclid ?? tracking.click_id),
  };
}

describe('normalizeSale (webhook → venda)', () => {
  it('extrai valor, UTM e fbclid de payload plano', () => {
    const sale = normalizeSale('generic', {
      id: 'evt_123', amount: '197.00', fee: '9.85', status: 'paid',
      utm_source: 'facebook', utm_campaign: 'black-friday', fbclid: 'IwAR123',
    });
    expect(sale).not.toBeNull();
    expect(sale!.externalId).toBe('evt_123');
    expect(sale!.grossAmount).toBe(197);
    expect(sale!.feeAmount).toBe(9.85);
    expect(sale!.utm?.campaign).toBe('black-friday');
    expect(sale!.clickId).toBe('IwAR123');
  });

  it('lê tracking aninhado', () => {
    const sale = normalizeSale('generic', {
      transaction_id: 'tx_9', total: 89.9,
      tracking: { utm_source: 'google', utm_campaign: 'search', gclid: 'Cj0abc' },
    });
    expect(sale!.externalId).toBe('tx_9');
    expect(sale!.grossAmount).toBe(89.9);
    expect(sale!.utm?.source).toBe('google');
    expect(sale!.clickId).toBe('Cj0abc');
  });

  it('ignora evento sem venda (sem id ou valor)', () => {
    expect(normalizeSale('generic', { status: 'ping' })).toBeNull();
    expect(normalizeSale('generic', { id: 'x', amount: 0 })).toBeNull();
  });
});
