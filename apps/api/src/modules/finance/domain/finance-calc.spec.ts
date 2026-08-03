import { computeFinance, FinanceRule } from './finance-calc';

describe('computeFinance (BLUEPRINT seção 7.2)', () => {
  const rules: FinanceRule[] = [
    { kind: 'TAX', calcType: 'PERCENT', value: 0.1, isActive: true }, // 10% imposto
    { kind: 'OPCOST', calcType: 'FIXED', value: 100, isActive: true }, // custo fixo
    { kind: 'TAX', calcType: 'FIXED', value: 50, isActive: false }, // inativa: ignorada
  ];

  it('calcula todos os agregados corretamente', () => {
    const r = computeFinance({
      valorInvestido: 1000,
      receitaBruta: 5000,
      taxasGateway: 200,
      rules,
    });

    expect(r.valorImposto).toBe(500); // 10% de 5000
    expect(r.custosOperacionais).toBe(100);
    expect(r.custoTotal).toBe(1800); // 1000 + 200 + 500 + 100
    expect(r.lucroBruto).toBe(4000); // 5000 - 1000
    expect(r.lucroLiquido).toBe(3200); // 5000 - 1800
    expect(r.margemLiquida).toBeCloseTo(0.64, 5);
  });

  it('ignora regras inativas', () => {
    const r = computeFinance({
      valorInvestido: 0,
      receitaBruta: 1000,
      taxasGateway: 0,
      rules: [{ kind: 'TAX', calcType: 'FIXED', value: 999, isActive: false }],
    });
    expect(r.valorImposto).toBe(0);
  });

  it('margem 0 quando receita é 0 (sem divisão por zero)', () => {
    const r = computeFinance({
      valorInvestido: 500,
      receitaBruta: 0,
      taxasGateway: 0,
      rules: [],
    });
    expect(r.margemLiquida).toBe(0);
    expect(r.lucroLiquido).toBe(-500);
  });
});
