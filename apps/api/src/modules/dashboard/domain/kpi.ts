/**
 * Cálculo de KPIs (BLUEPRINT seção 8.1) — função pura e determinística.
 * Entradas agregadas do período; saídas prontas para o dashboard.
 */

export interface KpiInput {
  investido: number; // Σ spend
  receitaBruta: number; // Σ gross_amount
  receitaLiquida: number; // Σ net_amount (já com taxas de gateway)
  lucroLiquido: number; // vindo do módulo financeiro
  impressoes: number;
  clicks: number;
  conversoes: number;
  leads: number;
  novosClientes: number;
}

export interface Kpis {
  investido: number;
  receitaBruta: number;
  receitaLiquida: number;
  lucroLiquido: number;
  roi: number;
  roas: number;
  cpa: number;
  cpl: number;
  cpm: number;
  ctr: number;
  cac: number;
  ticketMedio: number;
  margem: number;
  conversoes: number;
}

const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b);

export function computeKpis(i: KpiInput): Kpis {
  return {
    investido: i.investido,
    receitaBruta: i.receitaBruta,
    receitaLiquida: i.receitaLiquida,
    lucroLiquido: i.lucroLiquido,
    roi: safeDiv(i.lucroLiquido, i.investido),
    roas: safeDiv(i.receitaBruta, i.investido),
    cpa: safeDiv(i.investido, i.conversoes),
    cpl: safeDiv(i.investido, i.leads),
    cpm: safeDiv(i.investido, i.impressoes) * 1000,
    ctr: safeDiv(i.clicks, i.impressoes),
    cac: safeDiv(i.investido, i.novosClientes),
    ticketMedio: safeDiv(i.receitaBruta, i.conversoes),
    margem: safeDiv(i.lucroLiquido, i.receitaBruta),
    conversoes: i.conversoes,
  };
}

/** Variação percentual vs. período anterior. */
export function variation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 1;
  return (current - previous) / previous;
}
