/**
 * Cálculo financeiro (BLUEPRINT seção 7.2) — função pura e determinística.
 * Sem I/O, 100% testável. Uma única fonte da verdade para dashboard e relatórios.
 */

export type RuleKind = 'TAX' | 'FEE' | 'OPCOST';
export type CalcType = 'PERCENT' | 'FIXED';

export interface FinanceRule {
  kind: RuleKind;
  calcType: CalcType;
  value: number; // percent como fração (0.10 = 10%) ou valor fixo
  isActive: boolean;
}

export interface FinanceInput {
  valorInvestido: number; // Σ ad_metrics.spend
  receitaBruta: number; // Σ sales.gross_amount
  taxasGateway: number; // Σ sales.fee_amount
  rules: FinanceRule[];
}

export interface FinanceResult {
  valorInvestido: number;
  receitaBruta: number;
  taxasGateway: number;
  valorImposto: number;
  custosOperacionais: number;
  custoTotal: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemLiquida: number;
}

function sumRules(
  rules: FinanceRule[],
  kind: RuleKind,
  base: number,
): number {
  return rules
    .filter((r) => r.isActive && r.kind === kind)
    .reduce(
      (acc, r) =>
        acc + (r.calcType === 'PERCENT' ? base * r.value : r.value),
      0,
    );
}

export function computeFinance(input: FinanceInput): FinanceResult {
  const { valorInvestido, receitaBruta, taxasGateway, rules } = input;

  const valorImposto = sumRules(rules, 'TAX', receitaBruta);
  const custosOperacionais = sumRules(rules, 'OPCOST', receitaBruta);

  const custoTotal =
    valorInvestido + taxasGateway + valorImposto + custosOperacionais;

  const lucroBruto = receitaBruta - valorInvestido;
  const lucroLiquido = receitaBruta - custoTotal;
  const margemLiquida = receitaBruta === 0 ? 0 : lucroLiquido / receitaBruta;

  return {
    valorInvestido,
    receitaBruta,
    taxasGateway,
    valorImposto,
    custosOperacionais,
    custoTotal,
    lucroBruto,
    lucroLiquido,
    margemLiquida,
  };
}
