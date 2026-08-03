/** Nomes de filas e jobs BullMQ (BLUEPRINT seção 5.1). */
export const QUEUE_SYNC_SCHEDULE = 'sync:schedule';
export const QUEUE_SYNC_FETCH = 'sync:fetch';

export const JOB_FANOUT = 'fanout';
export const JOB_FETCH = 'fetch';

export interface FetchJobData {
  tenantId: string;
  integrationId: string;
  trigger: 'schedule' | 'manual';
}
