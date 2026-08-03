/**
 * Dataset de demonstração — usado quando a API não está disponível, para
 * pré-visualizar a interface do dashboard com números realistas.
 * Em produção, estes valores vêm de GET /dashboard/kpis.
 */
export interface DemoResult {
  kpis: Record<string, number>;
  variations: Record<string, number>;
}

const BASE: Record<string, { kpis: Record<string, number>; variations: Record<string, number> }> = {
  today: {
    kpis: { investido: 1840, receitaBruta: 7320, receitaLiquida: 6588, lucroLiquido: 3960, roi: 2.15, roas: 3.98, cpa: 14.2, cpl: 5.1, cpm: 18.4, ctr: 0.031, cac: 22.0, ticketMedio: 128.4, margem: 0.541, conversoes: 57 },
    variations: { investido: 0.08, receitaBruta: 0.12, receitaLiquida: 0.11, lucroLiquido: 0.19, roi: 0.10, roas: 0.04, cpa: -0.06, cpl: -0.03, cpm: 0.02, ctr: 0.05, cac: -0.04, ticketMedio: 0.03, margem: 0.06, conversoes: 0.14 },
  },
  '7d': {
    kpis: { investido: 12480, receitaBruta: 51200, receitaLiquida: 46080, lucroLiquido: 27700, roi: 2.22, roas: 4.10, cpa: 13.6, cpl: 4.8, cpm: 17.9, ctr: 0.034, cac: 20.8, ticketMedio: 133.2, margem: 0.541, conversoes: 384 },
    variations: { investido: 0.05, receitaBruta: 0.15, receitaLiquida: 0.15, lucroLiquido: 0.22, roi: 0.16, roas: 0.09, cpa: -0.08, cpl: -0.05, cpm: -0.01, ctr: 0.07, cac: -0.06, ticketMedio: 0.04, margem: 0.09, conversoes: 0.13 },
  },
  '30d': {
    kpis: { investido: 54200, receitaBruta: 218400, receitaLiquida: 196560, lucroLiquido: 118900, roi: 2.19, roas: 4.03, cpa: 13.9, cpl: 4.9, cpm: 18.1, ctr: 0.033, cac: 21.4, ticketMedio: 130.6, margem: 0.544, conversoes: 1672 },
    variations: { investido: 0.11, receitaBruta: 0.18, receitaLiquida: 0.18, lucroLiquido: 0.24, roi: 0.12, roas: 0.06, cpa: -0.05, cpl: -0.04, cpm: 0.01, ctr: 0.04, cac: -0.03, ticketMedio: 0.05, margem: 0.07, conversoes: 0.16 },
  },
  '90d': {
    kpis: { investido: 158900, receitaBruta: 622300, receitaLiquida: 560070, lucroLiquido: 331200, roi: 2.08, roas: 3.92, cpa: 14.4, cpl: 5.0, cpm: 18.6, ctr: 0.032, cac: 22.1, ticketMedio: 127.8, margem: 0.532, conversoes: 4870 },
    variations: { investido: 0.14, receitaBruta: 0.16, receitaLiquida: 0.16, lucroLiquido: 0.15, roi: 0.01, roas: -0.02, cpa: 0.03, cpl: 0.02, cpm: 0.03, ctr: -0.02, cac: 0.02, ticketMedio: -0.01, margem: -0.02, conversoes: 0.13 },
  },
  yesterday: {
    kpis: { investido: 1705, receitaBruta: 6540, receitaLiquida: 5886, lucroLiquido: 3320, roi: 1.95, roas: 3.84, cpa: 15.1, cpl: 5.3, cpm: 18.0, ctr: 0.029, cac: 23.2, ticketMedio: 124.8, margem: 0.508, conversoes: 52 },
    variations: { investido: -0.03, receitaBruta: 0.02, receitaLiquida: 0.02, lucroLiquido: 0.05, roi: 0.08, roas: 0.05, cpa: -0.02, cpl: -0.01, cpm: -0.01, ctr: 0.02, cac: -0.02, ticketMedio: 0.01, margem: 0.03, conversoes: 0.03 },
  },
  '365d': {
    kpis: { investido: 612400, receitaBruta: 2361000, receitaLiquida: 2124900, lucroLiquido: 1243000, roi: 2.03, roas: 3.86, cpa: 14.8, cpl: 5.1, cpm: 18.9, ctr: 0.031, cac: 22.6, ticketMedio: 126.2, margem: 0.526, conversoes: 18710 },
    variations: { investido: 0.28, receitaBruta: 0.34, receitaLiquida: 0.34, lucroLiquido: 0.41, roi: 0.10, roas: 0.05, cpa: -0.04, cpl: -0.03, cpm: 0.02, ctr: 0.03, cac: -0.05, ticketMedio: 0.06, margem: 0.08, conversoes: 0.31 },
  },
};

export function demoData(period: string): DemoResult {
  return BASE[period] ?? BASE['30d'];
}

export interface SeriesPoint { label: string; receita: number; investido: number; }

/** Série temporal para o gráfico de evolução (determinística por período). */
export function demoSeries(period: string): SeriesPoint[] {
  const days = period === 'today' || period === 'yesterday' ? 24
    : period === '7d' ? 7 : period === '90d' ? 12 : period === '365d' ? 12 : 30;
  const isHours = period === 'today' || period === 'yesterday';
  const base = (BASE[period] ?? BASE['30d']).kpis;
  const out: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const wave = 0.72 + 0.28 * Math.sin((i / days) * Math.PI * 2 + 0.6) + (i % 3) * 0.03;
    const receita = Math.round((base.receitaBruta / days) * wave);
    const investido = Math.round((base.investido / days) * (0.8 + 0.2 * wave));
    out.push({
      label: isHours ? `${String(i).padStart(2, '0')}h` : `${i + 1}`,
      receita,
      investido,
    });
  }
  return out;
}

export interface CampaignRow {
  plataforma: string;
  conta: string;
  investido: number;
  receita: number;
  roas: number;
  conversoes: number;
}

export function demoCampaigns(period: string): CampaignRow[] {
  const m = (BASE[period] ?? BASE['30d']).kpis;
  const split = [
    { plataforma: 'Meta Ads', conta: 'BM Principal', w: 0.46 },
    { plataforma: 'Meta Ads', conta: 'Cliente Studio X', w: 0.19 },
    { plataforma: 'Google Ads', conta: 'Search Brasil', w: 0.23 },
    { plataforma: 'TikTok Ads', conta: 'Awareness', w: 0.12 },
  ];
  return split.map((s) => {
    const investido = Math.round(m.investido * s.w);
    const receita = Math.round(m.receitaBruta * s.w * (0.9 + s.w));
    return {
      plataforma: s.plataforma,
      conta: s.conta,
      investido,
      receita,
      roas: investido ? +(receita / investido).toFixed(2) : 0,
      conversoes: Math.round(m.conversoes * s.w),
    };
  });
}
