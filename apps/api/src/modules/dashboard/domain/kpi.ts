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
  // Métricas Meta Ads adicionais (BLUEPRINT — mensagens é a prioridade do dono).
  messagingConversations: number; // conversas iniciadas via anúncio
  reach: number;
  frequency: number;
  metaCpm: number; // cpm reportado direto pela Graph API (média ponderada)
  metaCpc: number;
  metaCpp: number;
  metaCtr: number;
  metaLeads: number;
  purchases: number;
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
  // Métricas Meta Ads adicionais.
  mensagens: number; // conversas de mensagem iniciadas (messaging_conversations)
  custoPorMensagem: number; // spend / mensagens — KPI principal pedido pelo dono
  leadsMeta: number;
  compras: number;
  alcance: number;
  frequencia: number;
  metaCpm: number;
  metaCpc: number;
  metaCpp: number;
  metaCtr: number;
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
    mensagens: i.messagingConversations,
    custoPorMensagem: safeDiv(i.investido, i.messagingConversations),
    leadsMeta: i.metaLeads,
    compras: i.purchases,
    alcance: i.reach,
    frequencia: i.frequency,
    metaCpm: i.metaCpm,
    metaCpc: i.metaCpc,
    metaCpp: i.metaCpp,
    metaCtr: i.metaCtr,
  };
}

/** Variação percentual vs. período anterior. */
export function variation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 1;
  return (current - previous) / previous;
}
