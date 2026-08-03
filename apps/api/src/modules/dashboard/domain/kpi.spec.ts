import { computeKpis, variation } from './kpi';

describe('computeKpis (BLUEPRINT seção 8.1)', () => {
  it('calcula ROI, ROAS, CPA, CTR, CPM corretamente', () => {
    const k = computeKpis({
      investido: 1000,
      receitaBruta: 5000,
      receitaLiquida: 4500,
      lucroLiquido: 3000,
      impressoes: 100000,
      clicks: 2000,
      conversoes: 100,
      leads: 400,
      novosClientes: 80,
    });
    expect(k.roi).toBeCloseTo(3, 5); // 3000/1000
    expect(k.roas).toBeCloseTo(5, 5); // 5000/1000
    expect(k.cpa).toBeCloseTo(10, 5); // 1000/100
    expect(k.ctr).toBeCloseTo(0.02, 5); // 2000/100000
    expect(k.cpm).toBeCloseTo(10, 5); // 1000/100000*1000
    expect(k.ticketMedio).toBeCloseTo(50, 5); // 5000/100
    expect(k.margem).toBeCloseTo(0.6, 5); // 3000/5000
  });

  it('não divide por zero', () => {
    const k = computeKpis({
      investido: 0, receitaBruta: 0, receitaLiquida: 0, lucroLiquido: 0,
      impressoes: 0, clicks: 0, conversoes: 0, leads: 0, novosClientes: 0,
    });
    expect(k.roi).toBe(0);
    expect(k.cpm).toBe(0);
  });

  it('variation calcula variação percentual', () => {
    expect(variation(150, 100)).toBeCloseTo(0.5, 5);
    expect(variation(100, 0)).toBe(1);
    expect(variation(0, 0)).toBe(0);
  });
});
