import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  QUEUE_SYNC_FETCH,
  QUEUE_SYNC_SCHEDULE,
  JOB_FANOUT,
  JOB_FETCH,
  FetchJobData,
} from '../domain/queues';

@Injectable()
export class SyncService implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_SYNC_SCHEDULE) private readonly scheduleQ: Queue,
    @InjectQueue(QUEUE_SYNC_FETCH) private readonly fetchQ: Queue,
  ) {}

  /** Agenda o fanout repetível a cada 15 minutos (BLUEPRINT seção 5.2). */
  onModuleInit(): void {
    // Agenda o fanout SEM bloquear o boot da aplicação. Se o Redis estiver
    // indisponível/lento, a API sobe mesmo assim (o agendamento tenta em
    // background e não derruba o listen()).
    this.scheduleQ
      .add(
        JOB_FANOUT,
        {},
        {
          repeat: { every: 15 * 60 * 1000 },
          jobId: 'fanout-15m',
          removeOnComplete: true,
        },
      )
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Falha ao agendar fanout (Redis?):', err?.message ?? err);
      });
  }

  /** Enfileira o fetch de uma integração. */
  enqueueFetch(data: FetchJobData) {
    return this.fetchQ.add(JOB_FETCH, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  /**
   * "Atualizar Agora": alta prioridade e jobId determinístico para deduplicar
   * cliques repetidos — no máximo um sync manual em voo por integração
   * (BLUEPRINT seção 5.2).
   */
  updateNow(tenantId: string, integrationId: string) {
    return this.fetchQ.add(
      JOB_FETCH,
      { tenantId, integrationId, trigger: 'manual' } as FetchJobData,
      {
        priority: 1,
        // BullMQ rejeita ":" em jobId customizado ("Custom Id cannot contain :").
        jobId: `manual-${integrationId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }
}
