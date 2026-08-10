import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { IntegrationRegistry } from '../../integrations/application/integration.registry';
import { CredentialsService } from '../../integrations/application/credentials.service';
import { FetchJobData, QUEUE_SYNC_FETCH } from '../domain/queues';
import { NormalizedRecord } from '../../integrations/domain/connector';

interface MetaAdMetricData {
  provider: string;
  accountId: string;
  accountName: string;
  currency?: string;
  accountStatus?: number;
  campaignId: string;
  campaignName: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

// Primeira sincronização de uma integração meta_ads: puxa uma janela maior
// (30 dias) para o dashboard já nascer com histórico útil, em vez de só 1 dia.
const META_FIRST_SYNC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Executa a sincronização de uma integração (BLUEPRINT seção 5.3):
 * fetch → normalize → upsert idempotente → invalida cache → publica evento.
 */
@Processor(QUEUE_SYNC_FETCH)
export class FetchProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: IntegrationRegistry,
    private readonly credentials: CredentialsService,
  ) {
    super();
  }

  async process(job: Job<FetchJobData>): Promise<void> {
    const { tenantId, integrationId, trigger } = job.data;

    const run = await this.prisma.syncRun.create({
      data: {
        tenantId,
        integrationId,
        trigger,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId },
        include: { provider: true },
      });
      if (!integration) throw new Error('Integração inexistente');

      const cred = await this.credentials.get(integrationId);
      if (!cred) throw new Error('Sem credenciais');

      const connector = this.registry.get(integration.provider.code);
      const now = new Date();
      const defaultLookback =
        integration.provider.code === 'meta_ads' ? META_FIRST_SYNC_WINDOW_MS : 86400000;
      const window = {
        from: integration.lastSyncAt ?? new Date(now.getTime() - defaultLookback),
        to: now,
      };

      const batch = await connector.fetch(
        { tenantId, integrationId, window, cursor: integration.syncCursor ?? undefined },
        cred,
      );

      const upserted = await this.persistRecords(tenantId, integrationId, batch.records);

      // Enquanto houver cursor (checkpoint de retomada por rate limit), não
      // avança lastSyncAt — assim o próximo ciclo retoma a mesma janela.
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: {
          lastSyncAt: batch.hasMore ? integration.lastSyncAt ?? now : now,
          status: 'ACTIVE',
          syncCursor: batch.nextCursor ?? null,
        },
      });
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          recordsUpserted: upserted,
          cursor: batch.nextCursor,
        },
      });

      // Invalida cache de KPIs do tenant e notifica o dashboard em tempo real.
      await this.redis.invalidatePrefix(`kpi:${tenantId}:`);
      await this.redis.publish(`tenant:${tenantId}:metrics`, {
        type: 'sync.completed',
        integrationId,
        upserted,
        at: now.toISOString(),
      });
    } catch (err) {
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err; // deixa o BullMQ aplicar retry/backoff
    }
  }

  /**
   * Upsert idempotente dos registros normalizados. Para 'ad_metric' (Meta Ads
   * hoje), grava no grão diário por campanha em 3 tabelas: conta, campanha e
   * insight do dia (unique por conta+campanha+dia — nunca duplica).
   */
  private async persistRecords(
    tenantId: string,
    integrationId: string,
    records: NormalizedRecord[],
  ): Promise<number> {
    let count = 0;
    // Cache local para não bater no banco repetidamente pela mesma conta/campanha
    // dentro do mesmo batch (um batch pode ter centenas de linhas diárias).
    const accountCache = new Map<string, string>(); // accountId externo -> row id
    const campaignCache = new Map<string, string>(); // adAccountRowId:campaignId -> row id

    for (const rec of records) {
      if (rec.kind !== 'ad_metric') continue;
      const d = rec.data as unknown as MetaAdMetricData;
      if (d.provider !== 'meta_ads') continue;

      let accountRowId = accountCache.get(d.accountId);
      if (!accountRowId) {
        const account = await this.prisma.metaAdAccount.upsert({
          where: { integrationId_accountId: { integrationId, accountId: d.accountId } },
          create: {
            tenantId,
            integrationId,
            accountId: d.accountId,
            name: d.accountName,
            currency: d.currency,
            accountStatus: d.accountStatus,
            lastSyncAt: new Date(),
          },
          update: {
            name: d.accountName,
            currency: d.currency,
            accountStatus: d.accountStatus,
            lastSyncAt: new Date(),
          },
          select: { id: true },
        });
        accountRowId = account.id;
        accountCache.set(d.accountId, accountRowId);
      }

      const campaignCacheKey = `${accountRowId}:${d.campaignId}`;
      let campaignRowId = campaignCache.get(campaignCacheKey);
      if (!campaignRowId) {
        const campaign = await this.prisma.metaCampaign.upsert({
          where: { adAccountId_campaignId: { adAccountId: accountRowId, campaignId: d.campaignId } },
          create: {
            tenantId,
            adAccountId: accountRowId,
            campaignId: d.campaignId,
            name: d.campaignName,
          },
          update: { name: d.campaignName },
          select: { id: true },
        });
        campaignRowId = campaign.id;
        campaignCache.set(campaignCacheKey, campaignRowId);
      }

      await this.prisma.metaCampaignInsight.upsert({
        where: {
          ux_meta_insight_account_campaign_date: {
            adAccountId: accountRowId,
            campaignId: campaignRowId,
            date: new Date(d.date),
          },
        },
        create: {
          tenantId,
          integrationId,
          adAccountId: accountRowId,
          campaignId: campaignRowId,
          campaignExternalId: d.campaignId,
          campaignName: d.campaignName,
          date: new Date(d.date),
          spend: d.spend,
          impressions: BigInt(Math.round(d.impressions)),
          clicks: BigInt(Math.round(d.clicks)),
          conversions: d.conversions,
          conversionValue: d.conversionValue,
          currency: d.currency,
        },
        update: {
          campaignName: d.campaignName,
          spend: d.spend,
          impressions: BigInt(Math.round(d.impressions)),
          clicks: BigInt(Math.round(d.clicks)),
          conversions: d.conversions,
          conversionValue: d.conversionValue,
          currency: d.currency,
        },
      });
      count += 1;
    }
    return count;
  }
}
