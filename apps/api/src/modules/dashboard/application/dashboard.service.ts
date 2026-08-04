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
 * REAIS (tabela sales, recebidas via webhook), agrupadas por período/campanha.
 * O investido virá do gasto real da Meta/Google quando o OAuth entrar; por ora
 * é 0, mas o ROI/ROAS já são calculados sobre a receita real.
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
      hasData: currInput.receitaBruta > 0 || currInput.conversoes > 0,
    };
    await this.redis.cacheSet(cacheKey, result, 60);
    return result;
  }

  /** Vendas reais do período agregadas por campanha (utm_campaign). */
  async getCampaigns(tenantId: string, period: PeriodPreset): Promise<CampaignRow[]> {
    const { current } = resolvePeriod(period);
    const grouped = await this.prisma.sale.groupBy({
      by: ['utmCampaign'],
      where: {
        tenantId,
        status: { in: ['paid', 'approved', 'PURCHASE_APPROVED', 'succeeded'] },
        occurredAt: { gte: current.from, lte: current.to },
      },
      _sum: { grossAmount: true },
      _count: { _all: true },
    });

    return grouped.map((g) => {
      const receita = Number(g._sum.grossAmount ?? 0);
      const investido = 0; // virá do gasto da campanha (Meta/Google) no próximo passo
      return {
        campanha: g.utmCampaign ?? '(sem campanha)',
        investido,
        receita,
        roas: investido ? +(receita / investido).toFixed(2) : 0,
        conversoes: g._count._all,
      };
    }).sort((a, b) => b.receita - a.receita);
  }

  /**
   * Agrega vendas reais do período (receita bruta, líquida, taxas, conversões).
   * O investido/impressões/clicks virão dos dados de anúncios (Meta/Google).
   */
  private async aggregate(tenantId: string, range: DateRange): Promise<KpiInput> {
    const agg = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: { in: ['paid', 'approved', 'PURCHASE_APPROVED', 'succeeded'] },
        occurredAt: { gte: range.from, lte: range.to },
      },
      _sum: { grossAmount: true, netAmount: true },
      _count: { _all: true },
    });

    const receitaBruta = Number(agg._sum.grossAmount ?? 0);
    const receitaLiquida = Number(agg._sum.netAmount ?? 0);
    const conversoes = agg._count._all;
    const investido = 0; // gasto real dos anúncios entra com o OAuth Meta/Google

    return {
      investido,
      receitaBruta,
      receitaLiquida,
      lucroLiquido: receitaLiquida - investido,
      impressoes: 0,
      clicks: 0,
      conversoes,
      leads: 0,
      novosClientes: conversoes,
    };
  }
}
