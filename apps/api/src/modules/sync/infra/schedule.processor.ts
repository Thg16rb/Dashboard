import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { SyncService } from '../application/sync.service';
import { QUEUE_SYNC_SCHEDULE } from '../domain/queues';

/**
 * A cada 15 min, faz fan-out: um job de fetch por integração ativa
 * (BLUEPRINT seção 5.2). Roda sem contexto de request → lê todas as
 * integrações ativas diretamente (RLS não se aplica a jobs de sistema).
 */
@Processor(QUEUE_SYNC_SCHEDULE)
export class ScheduleProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const actives = await this.prisma.integration.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, tenantId: true },
    });
    for (const i of actives) {
      await this.sync.enqueueFetch({
        tenantId: i.tenantId,
        integrationId: i.id,
        trigger: 'schedule',
      });
    }
  }
}
