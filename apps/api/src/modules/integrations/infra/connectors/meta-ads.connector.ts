import { Injectable } from '@nestjs/common';
import {
  IntegrationConnector,
  DecryptedCredential,
  SyncContext,
  SyncBatch,
  ValidationResult,
} from '../../domain/connector';

/**
 * Connector Meta Ads (BLUEPRINT seção 4.2).
 * Estrutura conforme o contrato; a chamada real à Graph API entra no Passo 5
 * (fetch de insights com rate-limit e paginação por cursor).
 */
@Injectable()
export class MetaAdsConnector implements IntegrationConnector {
  readonly code = 'meta_ads';
  readonly category = 'ads' as const;
  readonly authType = 'oauth2' as const;

  async validateCredentials(cred: DecryptedCredential): Promise<ValidationResult> {
    if (!cred.accessToken || !cred.adAccountId) {
      return { valid: false, message: 'accessToken e adAccountId são obrigatórios' };
    }
    return { valid: true };
  }

  async fetch(_ctx: SyncContext, _cred: DecryptedCredential): Promise<SyncBatch> {
    // Placeholder estrutural: a integração real com a Graph API é feita no Passo 5.
    return { records: [], hasMore: false };
  }
}
