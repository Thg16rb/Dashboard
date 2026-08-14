import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CredentialsService } from '../../integrations/application/credentials.service';
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

export interface TimeseriesPoint {
  date: string; // YYYY-MM-DD
  investido: number;
  mensagens: number;
  receita: number;
  leads: number;
  compras: number;
  alcance: number;
  cliques: number;
  impressoes: number;
}

export interface HourlyPoint {
  hora: number; // 0..23
  gasto: number;
  mensagens: number;
}

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const HOURLY_REQUEST_TIMEOUT_MS = 60_000;
const MESSAGING_CONVERSATIONS_ACTION_TYPE =
  'onsite_conversion.messaging_conversation_started_7d';

interface HourlyInsightRow {
  hourly_stats_aggregated_by_advertiser_time_zone?: string; // "09:00:00 - 09:59:59"
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
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
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
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
   * Série diária do período (para o gráfico de evolução): investido e
   * mensagens vêm de meta_campaign_insights (grão diário, campo `date`);
   * receita vem das vendas reais (`sales.occurred_at`, convertido para o dia
   * local). Todos os dias do range aparecem, mesmo sem dado (zerados), para
   * o eixo do gráfico ficar contínuo.
   */
  async getTimeseries(tenantId: string, period: PeriodPreset): Promise<TimeseriesPoint[]> {
    const cacheKey = `timeseries:${tenantId}:${period}`;
    const cached = await this.redis.cacheGet<TimeseriesPoint[]>(cacheKey);
    if (cached) return cached;

    const { current } = resolvePeriod(period);

    const [spendRows, salesRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          day: Date;
          spend: unknown;
          mensagens: unknown;
          leads: unknown;
          compras: unknown;
          alcance: unknown;
          cliques: unknown;
          impressoes: unknown;
        }>
      >`
        SELECT date::date AS day,
               COALESCE(SUM(spend), 0) AS spend,
               COALESCE(SUM(messaging_conversations), 0) AS mensagens,
               COALESCE(SUM(leads), 0) AS leads,
               COALESCE(SUM(purchases), 0) AS compras,
               COALESCE(SUM(reach), 0) AS alcance,
               COALESCE(SUM(clicks), 0) AS cliques,
               COALESCE(SUM(impressions), 0) AS impressoes
        FROM meta_campaign_insights
        WHERE tenant_id = ${tenantId}::uuid
          AND date >= ${current.from}
          AND date <= ${current.to}
        GROUP BY date::date
        ORDER BY day ASC
      `,
      this.prisma.$queryRaw<Array<{ day: Date; receita: unknown }>>`
        SELECT occurred_at::date AS day,
               COALESCE(SUM(gross_amount), 0) AS receita
        FROM sales
        WHERE tenant_id = ${tenantId}::uuid
          AND status IN ('paid', 'approved', 'PURCHASE_APPROVED', 'succeeded')
          AND occurred_at >= ${current.from}
          AND occurred_at <= ${current.to}
        GROUP BY occurred_at::date
        ORDER BY day ASC
      `,
    ]);

    const toKey = (d: Date): string => {
      const x = new Date(d);
      return x.toISOString().slice(0, 10);
    };

    const spendByDay = new Map<
      string,
      {
        investido: number;
        mensagens: number;
        leads: number;
        compras: number;
        alcance: number;
        cliques: number;
        impressoes: number;
      }
    >();
    for (const r of spendRows) {
      spendByDay.set(toKey(r.day), {
        investido: Number(r.spend ?? 0),
        mensagens: Number(r.mensagens ?? 0),
        leads: Number(r.leads ?? 0),
        compras: Number(r.compras ?? 0),
        alcance: Number(r.alcance ?? 0),
        cliques: Number(r.cliques ?? 0),
        impressoes: Number(r.impressoes ?? 0),
      });
    }
    const receitaByDay = new Map<string, number>();
    for (const r of salesRows) {
      receitaByDay.set(toKey(r.day), Number(r.receita ?? 0));
    }

    // Preenche todos os dias do range (contínuo, mesmo sem dado).
    const points: TimeseriesPoint[] = [];
    const dayMs = 86400000;
    const fromDay = new Date(current.from);
    fromDay.setUTCHours(0, 0, 0, 0);
    const toDay = new Date(current.to);
    toDay.setUTCHours(0, 0, 0, 0);
    for (let t = fromDay.getTime(); t <= toDay.getTime(); t += dayMs) {
      const key = toKey(new Date(t));
      const spend = spendByDay.get(key);
      points.push({
        date: key,
        investido: spend?.investido ?? 0,
        mensagens: spend?.mensagens ?? 0,
        receita: receitaByDay.get(key) ?? 0,
        leads: spend?.leads ?? 0,
        compras: spend?.compras ?? 0,
        alcance: spend?.alcance ?? 0,
        cliques: spend?.cliques ?? 0,
        impressoes: spend?.impressoes ?? 0,
      });
    }

    await this.redis.cacheSet(cacheKey, points, 60);
    return points;
  }

  /**
   * Gasto e mensagens agregados por HORA (0-23h), somando todas as horas
   * iguais dos dias do período (Opção B do pedido: sem granularidade horária
   * persistida no banco — os insights salvos são diários). Bate na Graph API
   * com breakdowns=hourly_stats_aggregated_by_advertiser_time_zone, uma vez
   * por conta ativa do tenant, e soma as 24 faixas. Cacheado em Redis por
   * 10min para não estourar rate limit nem deixar a tela lenta.
   */
  async getHourly(tenantId: string, period: PeriodPreset): Promise<HourlyPoint[]> {
    const cacheKey = `hourly:${tenantId}:${period}`;
    const cached = await this.redis.cacheGet<HourlyPoint[]>(cacheKey);
    if (cached) return cached;

    const points: HourlyPoint[] = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      gasto: 0,
      mensagens: 0,
    }));

    const integration = await this.prisma.integration.findFirst({
      where: { tenantId, status: 'ACTIVE', provider: { code: 'meta_ads' } },
      select: { id: true },
    });
    if (!integration) {
      await this.redis.cacheSet(cacheKey, points, 600);
      return points;
    }

    const cred = await this.credentials.get(integration.id);
    const token = cred?.accessToken;
    if (!token) {
      await this.redis.cacheSet(cacheKey, points, 600);
      return points;
    }

    const accounts = await this.prisma.metaAdAccount.findMany({
      where: { tenantId, integrationId: integration.id, isActive: true },
      select: { accountId: true },
    });
    if (accounts.length === 0) {
      await this.redis.cacheSet(cacheKey, points, 600);
      return points;
    }

    const timeParam = this.periodToGraphTimeParam(period);

    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const rows = await this.fetchHourlyInsights(acc.accountId, token, timeParam);
          for (const row of rows) {
            const hora = this.parseHourBucket(
              row.hourly_stats_aggregated_by_advertiser_time_zone,
            );
            if (hora === null) continue;
            const spend = parseFloat(row.spend ?? '0') || 0;
            const mensagens = this.findActionValue(
              row.actions,
              MESSAGING_CONVERSATIONS_ACTION_TYPE,
            );
            points[hora].gasto += spend;
            points[hora].mensagens += mensagens;
          }
        } catch (err) {
          this.logger.warn(
            `Falha ao buscar insights por hora da conta ${acc.accountId}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }),
    );

    for (const p of points) {
      p.gasto = +p.gasto.toFixed(2);
    }

    await this.redis.cacheSet(cacheKey, points, 600);
    return points;
  }

  /** Mapeia o preset do dashboard para date_preset/time_range da Graph API. */
  private periodToGraphTimeParam(period: PeriodPreset): Record<string, string> {
    const presetMap: Partial<Record<PeriodPreset, string>> = {
      today: 'today',
      yesterday: 'yesterday',
      '7d': 'last_7d',
      '30d': 'last_30d',
      '90d': 'last_90d',
    };
    const preset = presetMap[period];
    if (preset) return { date_preset: preset };

    // Fallback (ex.: 365d, sem date_preset direto na API): usa time_range.
    const { current } = resolvePeriod(period);
    return {
      time_range: JSON.stringify({
        since: current.from.toISOString().slice(0, 10),
        until: current.to.toISOString().slice(0, 10),
      }),
    };
  }

  private async fetchHourlyInsights(
    accountId: string,
    accessToken: string,
    timeParam: Record<string, string>,
  ): Promise<HourlyInsightRow[]> {
    const url = new URL(`${GRAPH_BASE}/${accountId}/insights`);
    url.searchParams.set('level', 'account');
    url.searchParams.set(
      'breakdowns',
      'hourly_stats_aggregated_by_advertiser_time_zone',
    );
    url.searchParams.set('fields', 'spend,actions');
    for (const [k, v] of Object.entries(timeParam)) url.searchParams.set(k, v);
    url.searchParams.set('limit', '50');
    url.searchParams.set('access_token', accessToken);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HOURLY_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      const json = (await res.json()) as {
        data?: HourlyInsightRow[];
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? res.statusText);
      }
      return json.data ?? [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseHourBucket(bucket: string | undefined): number | null {
    if (!bucket) return null;
    const match = bucket.match(/^(\d{2}):/);
    if (!match) return null;
    const hora = parseInt(match[1], 10);
    return hora >= 0 && hora <= 23 ? hora : null;
  }

  private findActionValue(
    rows: Array<{ action_type: string; value: string }> | undefined,
    actionType: string,
  ): number {
    if (!rows) return 0;
    const row = rows.find((r) => r.action_type === actionType);
    return row ? parseFloat(row.value) || 0 : 0;
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
        _sum: {
          spend: true,
          impressions: true,
          clicks: true,
          messagingConversations: true,
          reach: true,
          leads: true,
          purchases: true,
        },
        _avg: {
          frequency: true,
          cpm: true,
          cpc: true,
          cpp: true,
          ctr: true,
        },
      }),
    ]);

    const receitaBruta = Number(salesAgg._sum.grossAmount ?? 0);
    const receitaLiquida = Number(salesAgg._sum.netAmount ?? 0);
    const conversoes = salesAgg._count._all;
    const investido = Number(metaAgg._sum.spend ?? 0);
    const impressoes = Number(metaAgg._sum.impressions ?? 0);
    const clicks = Number(metaAgg._sum.clicks ?? 0);
    const messagingConversations = Number(metaAgg._sum.messagingConversations ?? 0);
    const reach = Number(metaAgg._sum.reach ?? 0);
    const metaLeads = Number(metaAgg._sum.leads ?? 0);
    const purchases = Number(metaAgg._sum.purchases ?? 0);
    const frequency = Number(metaAgg._avg.frequency ?? 0);
    const metaCpm = Number(metaAgg._avg.cpm ?? 0);
    const metaCpc = Number(metaAgg._avg.cpc ?? 0);
    const metaCpp = Number(metaAgg._avg.cpp ?? 0);
    const metaCtr = Number(metaAgg._avg.ctr ?? 0);

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
      messagingConversations,
      reach,
      frequency,
      metaCpm,
      metaCpc,
      metaCpp,
      metaCtr,
      metaLeads,
      purchases,
    };
  }
}
