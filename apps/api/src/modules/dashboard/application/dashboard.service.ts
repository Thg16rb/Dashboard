import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import { computeKpis, variation, Kpis, KpiInput } from '../domain/kpi';
import { PeriodPreset, resolvePeriod, DateRange } from '../domain/periods';

export interface DashboardResult {
  period: PeriodPreset;
  range: { from: string; to: string };
  kpis: Kpis;
  variations: Partial<Record<keyof Kpis, number>>;
}

/**
 * KPIs server-side com comparação por período e cache por (tenant, período)
 * (BLUEPRINT seção 8). As agregações de ad_metrics/sales entram quando as
 * tabelas particionadas forem criadas (Passo 4+ de dados); por ora as somas
 * partem de zero, mas todo o pipeline de cálculo/cache/variação está pronto.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly redis: RedisService) {}

  async getKpis(
    tenantId: string,
    period: PeriodPreset,
  ): Promise<DashboardResult> {
    const cacheKey = `kpi:${tenantId}:${period}`;
    const cached = await this.redis.cacheGet<DashboardResult>(cacheKey);
    if (cached) return cached;

    const { current, previous } = resolvePeriod(period);
    const curr = computeKpis(await this.aggregate(tenantId, current));
    const prev = computeKpis(await this.aggregate(tenantId, previous));

    const variations: Partial<Record<keyof Kpis, number>> = {};
    (Object.keys(curr) as (keyof Kpis)[]).forEach((k) => {
      variations[k] = variation(curr[k], prev[k]);
    });

    const result: DashboardResult = {
      period,
      range: { from: current.from.toISOString(), to: current.to.toISOString() },
      kpis: curr,
      variations,
    };
    await this.redis.cacheSet(cacheKey, result, 60);
    return result;
  }

  /**
   * Agrega métricas e vendas do período. Placeholder de somas até as tabelas
   * particionadas existirem — a assinatura e o formato já são os definitivos.
   */
  private async aggregate(
    _tenantId: string,
    _range: DateRange,
  ): Promise<KpiInput> {
    return {
      investido: 0,
      receitaBruta: 0,
      receitaLiquida: 0,
      lucroLiquido: 0,
      impressoes: 0,
      clicks: 0,
      conversoes: 0,
      leads: 0,
      novosClientes: 0,
    };
  }
}
