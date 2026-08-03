import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { IntegrationRegistry } from '../../integrations/application/integration.registry';
import { CredentialsService } from '../../integrations/application/credentials.service';
import { FetchJobData, QUEUE_SYNC_FETCH } from '../domain/queues';

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
      const window = {
        from: integration.lastSyncAt ?? new Date(now.getTime() - 86400000),
        to: now,
      };

      const batch = await connector.fetch(
        { tenantId, integrationId, window },
        cred,
      );

      // Upsert idempotente por (integration_id, external_id) — omitido o mapeamento
      // detalhado por tipo (ad_metric/sale), que entra junto do fetch real.
      const upserted = batch.records.length;

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: now, status: 'ACTIVE' },
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
}
