import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { computeKpis, variation, Kpis, KpiInput } from '../domain/kpi';
import { PeriodPreset, resolvePeriod, DateRange } from '../domain/periods';

export interface DashboardResult {
  period: PeriodPreset;
  range: { from: string; to: string };
  kpis: Kpis;
  variations: Partial<Record<keyof Kpis, number>>;
  hasData: boolean;
}

export interface CampaignRow {
  campanha: string;
  investido: number;
  receita: number;
  roas: number;
  conversoes: number;
}

/**
 * KPIs server-side (BLUEPRINT seção 8). A receita/conversões vêm das VENDAS
 * REAIS (tabela sales, recebidas via webhook); o investido/impressões/clicks
 * vêm dos insights REAIS da Meta (meta_campaign_insights, sincronizados a
 * cada 15min pelo job de sync — leitura aqui é sempre local, nunca bate na
 * Graph API no request do usuário).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getKpis(tenantId: string, period: PeriodPreset): Promise<DashboardResult> {
    const cacheKey = `kpi:${tenantId}:${period}`;
    const cached = await this.redis.cacheGet<DashboardResult>(cacheKey);
    if (cached) return cached;

    const { current, previous } = resolvePeriod(period);
    const currInput = await this.aggregate(tenantId, current);
    const prevInput = await this.aggregate(tenantId, previous);
    const curr = computeKpis(currInput);
    const prev = computeKpis(prevInput);

    const variations: Partial<Record<keyof Kpis, number>> = {};
    (Object.keys(curr) as (keyof Kpis)[]).forEach((k) => {
      variations[k] = variation(curr[k], prev[k]);
    });

    const result: DashboardResult = {
      period,
      range: { from: current.from.toISOString(), to: current.to.toISOString() },
      kpis: curr,
      variations,
      hasData: currInput.receitaBruta > 0 || currInput.conversoes > 0 || currInput.investido > 0,
    };
    await this.redis.cacheSet(cacheKey, result, 60);
    return result;
  }

  /**
   * Receita real (vendas, agrupadas por utm_campaign) casada com o gasto real
   * da Meta (meta_campaign_insights, agrupado por nome de campanha) — ambos
   * lidos do banco local. ROI/ROAS por campanha fecham quando os nomes batem
   * (utm_campaign = nome da campanha na Meta, prática usual de rastreamento).
   */
  async getCampaigns(tenantId: string, period: PeriodPreset): Promise<CampaignRow[]> {
    const { current } = resolvePeriod(period);

    const [salesGrouped, spendGrouped] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['utmCampaign'],
        where: {
          tenantId,
          status: { in: ['paid', 'approved', 'PURCHASE_APPROVED', 'succeeded'] },
          occurredAt: { gte: current.from, lte: current.to },
        },
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
      this.prisma.metaCampaignInsight.groupBy({
        by: ['campaignName'],
        where: {
          tenantId,
          date: { gte: current.from, lte: current.to },
        },
        _sum: { spend: true },
      }),
    ]);

    const spendByName = new Map<string, number>();
    for (const s of spendGrouped) {
      spendByName.set(s.campaignName.trim().toLowerCase(), Number(s._sum.spend ?? 0));
    }

    const rows: CampaignRow[] = salesGrouped.map((g) => {
      const receita = Number(g._sum.grossAmount ?? 0);
      const key = (g.utmCampaign ?? '').trim().toLowerCase();
      const investido = spendByName.get(key) ?? 0;
      if (key) spendByName.delete(key); // marca como já casada
      return {
        campanha: g.utmCampaign ?? '(sem campanha)',
        investido,
        receita,
        roas: investido ? +(receita / investido).toFixed(2) : 0,
        conversoes: g._count._all,
      };
    });

    // Campanhas Meta com gasto mas ainda sem venda casada (utm não bateu) —
    // mostra o investimento mesmo assim, para não "esconder" gasto real.
    for (const [name, investido] of spendByName) {
      rows.push({ campanha: name, investido, receita: 0, roas: 0, conversoes: 0 });
    }

    return rows.sort((a, b) => b.receita - a.receita || b.investido - a.investido);
  }

  /**
   * Agrega vendas reais do período (receita bruta, líquida, taxas, conversões)
   * e gasto/impressões/clicks reais da Meta (meta_campaign_insights).
   */
  private async aggregate(tenantId: string, range: DateRange): Promise<KpiInput> {
    const [salesAgg, metaAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          tenantId,
          status: { in: ['paid', 'approved', 'PURCHASE_APPROVED', 'succeeded'] },
          occurredAt: { gte: range.from, lte: range.to },
        },
        _sum: { grossAmount: true, netAmount: true },
        _count: { _all: true },
      }),
      this.prisma.metaCampaignInsight.aggregate({
        where: { tenantId, date: { gte: range.from, lte: range.to } },
        _sum: { spend: true, impressions: true, clicks: true },
      }),
    ]);

    const receitaBruta = Number(salesAgg._sum.grossAmount ?? 0);
    const receitaLiquida = Number(salesAgg._sum.netAmount ?? 0);
    const conversoes = salesAgg._count._all;
    const investido = Number(metaAgg._sum.spend ?? 0);
    const impressoes = Number(metaAgg._sum.impressions ?? 0);
    const clicks = Number(metaAgg._sum.clicks ?? 0);

    return {
      investido,
      receitaBruta,
      receitaLiquida,
      lucroLiquido: receitaLiquida - investido,
      impressoes,
      clicks,
      conversoes,
      leads: 0,
      novosClientes: conversoes,
    };
  }
}
