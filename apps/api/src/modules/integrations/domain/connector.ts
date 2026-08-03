/**
 * Contrato padrão de integração (BLUEPRINT seção 4.1).
 * Todo provedor (ads ou gateway) implementa esta interface; o pipeline de sync
 * conhece apenas o contrato, nunca um provedor específico (Open/Closed).
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DecryptedCredential {
  [key: string]: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface SyncContext {
  tenantId: string;
  integrationId: string;
  cursor?: string;
  window: DateRange;
}

/** Registro canônico normalizado (ads ou venda) gravado no banco. */
export interface NormalizedRecord {
  kind: 'ad_metric' | 'sale';
  externalId: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

export interface SyncBatch {
  records: NormalizedRecord[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface NormalizedEvent {
  eventType: string;
  externalId: string;
  data: Record<string, unknown>;
}

export type IntegrationCategory = 'ads' | 'gateway';
export type AuthType = 'oauth2' | 'api_key' | 'webhook';

export interface IntegrationConnector {
  readonly code: string;
  readonly category: IntegrationCategory;
  readonly authType: AuthType;

  validateCredentials(cred: DecryptedCredential): Promise<ValidationResult>;
  fetch(ctx: SyncContext, cred: DecryptedCredential): Promise<SyncBatch>;

  /** Gateways: verificação de assinatura e parse de evento de webhook. */
  verifySignature?(
    headers: Record<string, string | undefined>,
    rawBody: string,
    secret: string,
  ): boolean;
  parseEvent?(payload: unknown): NormalizedEvent;
}
