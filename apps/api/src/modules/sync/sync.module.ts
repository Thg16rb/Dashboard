import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SyncService } from './application/sync.service';
import { SyncController } from './infra/sync.controller';
import { ScheduleProcessor } from './infra/schedule.processor';
import { FetchProcessor } from './infra/fetch.processor';
import { QUEUE_SYNC_FETCH, QUEUE_SYNC_SCHEDULE } from './domain/queues';

/**
 * SyncModule — pipeline BullMQ (BLUEPRINT seção 5).
 * Scheduler (15 min) → fanout → fila de fetch concorrente → upsert idempotente
 * → invalida cache + publica evento de tempo real.
 */
@Module({
  imports: [
    AuthModule,
    IntegrationsModule,
    BullModule.registerQueue(
      { name: QUEUE_SYNC_SCHEDULE },
      { name: QUEUE_SYNC_FETCH },
    ),
  ],
  controllers: [SyncController],
  providers: [SyncService, ScheduleProcessor, FetchProcessor],
  exports: [SyncService],
})
export class SyncModule {}
