import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationConnector,
  DecryptedCredential,
  SyncContext,
  SyncBatch,
  ValidationResult,
  NormalizedRecord,
} from '../../domain/connector';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 180_000; // insights de conta grande demoram (spec)

// Códigos de erro Meta considerados TRANSITÓRIOS (retry com backoff exponencial).
// 1/2 = erro interno/temporário; 4 = limite de chamadas da app; 17 = limite de
// usuário; 32/613 = rate limit; 80000-80004 = limites específicos de ads insights.
const TRANSIENT_ERROR_CODES = new Set([1, 2, 4, 32, 613, 80000, 80001, 80002, 80003, 80004]);
// 17/190/200s = token inválido/permissão/bloqueio de conta → NÃO retry, pula a conta.
const PERMANENT_ERROR_CODES = new Set([17, 190, 200, 10, 100, 270]);

interface GraphError {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

interface AdAccount {
  account_id: string;
  id: string; // "act_123"
  name: string;
  currency: string;
  account_status: number;
}

interface CampaignInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  date_start: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  reach?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  cpp?: string;
  ctr?: string;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cost_per_inline_link_click?: string;
  unique_clicks?: string;
  unique_ctr?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Prioriza omni_purchase; senão pega o MAIOR valor entre alternativas de compra (nunca soma, evita dobrar faturamento). */
const PURCHASE_ACTION_TYPES = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
  'onsite_web_purchase',
  'onsite_web_app_purchase',
];

function dedupPurchaseMetric(
  rows: Array<{ action_type: string; value: string }> | undefined,
): number {
  if (!rows || rows.length === 0) return 0;
  const omni = rows.find((r) => r.action_type === 'omni_purchase');
  if (omni) return parseFloat(omni.value) || 0;
  let max = 0;
  for (const type of PURCHASE_ACTION_TYPES) {
    const row = rows.find((r) => r.action_type === type);
    if (row) {
      const v = parseFloat(row.value) || 0;
      if (v > max) max = v;
    }
  }
  return max;
}

/**
 * Métricas de MENSAGENS (PRIORIDADE — pedido explícito do dono): conversas
 * iniciadas, primeira resposta, conexões totais e pedidos via mensagem.
 * Não há duplicidade conhecida nestes action_types (cada um é único no
 * array `actions`), então lookup direto é suficiente.
 */
const MESSAGING_ACTION_TYPES = {
  conversations: 'onsite_conversion.messaging_conversation_started_7d',
  firstReply: 'onsite_conversion.messaging_first_reply',
  connections: 'onsite_conversion.total_messaging_connection',
  orders: 'onsite_conversion.messaging_order_created_v2',
} as const;

/** Leads: dedup — prioriza onsite_conversion.lead, senão 'lead' genérico, nunca soma os dois. */
const LEAD_ACTION_TYPES = ['onsite_conversion.lead', 'lead'];

function findActionValue(
  rows: Array<{ action_type: string; value: string }> | undefined,
  actionType: string,
): number {
  if (!rows) return 0;
  const row = rows.find((r) => r.action_type === actionType);
  return row ? parseFloat(row.value) || 0 : 0;
}

/** Dedup por MAIOR valor entre alternativas (nunca soma — evita duplicar contagem). */
function dedupMaxMetric(
  rows: Array<{ action_type: string; value: string }> | undefined,
  types: string[],
): number {
  if (!rows || rows.length === 0) return 0;
  let max = 0;
  for (const type of types) {
    const v = findActionValue(rows, type);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Connector Meta Ads (Graph API real).
 *
 * - validateCredentials: debug_token + /me/adaccounts.
 * - fetch: lista contas ativas da integração e puxa insights diários por
 *   campanha (level=campaign, time_increment=1), com paginação por cursor,
 *   janela mensal (regra da Graph API para nível conta/campanha) e retry com
 *   backoff exponencial em erros transitórios.
 */
@Injectable()
export class MetaAdsConnector implements IntegrationConnector {
  readonly code = 'meta_ads';
  readonly category = 'ads' as const;
  readonly authType = 'oauth2' as const;

  private readonly logger = new Logger(MetaAdsConnector.name);

  private async graphGet<T = any>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`${GRAPH_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', accessToken);

    const maxAttempts = 5;
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        const json = (await res.json()) as T & GraphError;

        if (!res.ok || json.error) {
          const code = json.error?.code;
          const isTransient =
            res.status === 429 ||
            res.status >= 500 ||
            (code !== undefined && TRANSIENT_ERROR_CODES.has(code));
          const isPermanent = code !== undefined && PERMANENT_ERROR_CODES.has(code);

          if (isPermanent || !isTransient || attempt >= maxAttempts) {
            const err = new Error(
              `Graph API erro${isPermanent ? ' (permanente)' : ''}: ${json.error?.message ?? res.statusText} (code=${code ?? res.status})`,
            );
            (err as Error & { permanent?: boolean }).permanent = isPermanent || !isTransient;
            throw err;
          }

          // Transitório: backoff exponencial (1s, 2s, 4s, 8s...).
          const delay = 1000 * 2 ** (attempt - 1);
          this.logger.warn(
            `Graph API transitório (code=${code}, tentativa ${attempt}/${maxAttempts}); retry em ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }
        return json;
      } catch (err) {
        clearTimeout(timeout);
        if ((err as Error & { permanent?: boolean }).permanent) throw err;
        if (attempt >= maxAttempts) throw err;
        const delay = 1000 * 2 ** (attempt - 1);
        this.logger.warn(`Falha de rede (tentativa ${attempt}/${maxAttempts}); retry em ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  /** Segue paging.next (cursor) manualmente — nunca monta offset. */
  private async graphGetPaginated<T = any>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T[]> {
    const out: T[] = [];
    let nextUrl: string | null = null;
    let first = true;

    for (;;) {
      let json: { data: T[]; paging?: { next?: string } };
      if (first) {
        json = await this.graphGet<{ data: T[]; paging?: { next?: string } }>(
          path,
          { ...params, limit: String(PAGE_LIMIT) },
          accessToken,
        );
        first = false;
      } else if (nextUrl) {
        json = await this.fetchRawUrl<{ data: T[]; paging?: { next?: string } }>(nextUrl);
      } else {
        break;
      }
      out.push(...(json.data ?? []));
      nextUrl = json.paging?.next ?? null;
      if (!nextUrl) break;
    }
    return out;
  }

  private async fetchRawUrl<T>(url: string): Promise<T> {
    const maxAttempts = 5;
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const json = (await res.json()) as T & GraphError;
        if (!res.ok || json.error) {
          const code = json.error?.code;
          const isTransient =
            res.status === 429 || res.status >= 500 || (code !== undefined && TRANSIENT_ERROR_CODES.has(code));
          if (!isTransient || attempt >= maxAttempts) {
            throw new Error(`Graph API erro (paginação): ${json.error?.message ?? res.statusText}`);
          }
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        return json;
      } catch (err) {
        clearTimeout(timeout);
        if (attempt >= maxAttempts) throw err;
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
  }

  /** debug_token + /me/adaccounts (spec: validação obrigatória do token). */
  async validateCredentials(cred: DecryptedCredential): Promise<ValidationResult> {
    const token = cred.accessToken;
    if (!token) {
      return { valid: false, message: 'accessToken é obrigatório' };
    }
    try {
      const debug = await this.graphGet<{ data?: { is_valid?: boolean; scopes?: string[] } }>(
        '/debug_token',
        { input_token: token },
        token,
      );
      if (!debug.data?.is_valid) {
        return { valid: false, message: 'Token inválido ou expirado' };
      }
      const accounts = await this.graphGetPaginated<AdAccount>(
        '/me/adaccounts',
        { fields: 'account_id,name,currency,account_status' },
        token,
      );
      if (accounts.length === 0) {
        return { valid: false, message: 'Token válido, mas nenhuma conta de anúncio acessível' };
      }
      return { valid: true, message: `${accounts.length} conta(s) de anúncio encontrada(s)` };
    } catch (err) {
      return { valid: false, message: err instanceof Error ? err.message : 'Falha ao validar token' };
    }
  }

  /**
   * Lista contas ativas e puxa insights diários por campanha, dentro da
   * janela mensal (regra Graph API nível conta/campanha). Retoma por
   * checkpoint de conta via cursor (ctx.cursor = índice da última conta OK).
   */
  async fetch(ctx: SyncContext, cred: DecryptedCredential): Promise<SyncBatch> {
    const token = cred.accessToken;
    if (!token) return { records: [], hasMore: false };

    const accounts = await this.graphGetPaginated<AdAccount>(
      '/me/adaccounts',
      { fields: 'account_id,name,currency,account_status' },
      token,
    );
    // account_status === 1 = ACTIVE na Meta.
    const activeAccounts = accounts.filter((a) => a.account_status === 1);

    const startIdx = ctx.cursor ? parseInt(ctx.cursor, 10) || 0 : 0;
    const records: NormalizedRecord[] = [];

    // Janelas mensais (limite Graph API) dentro do range solicitado.
    const monthlyWindows = this.splitIntoMonthlyWindows(ctx.window.from, ctx.window.to);

    for (let i = startIdx; i < activeAccounts.length; i++) {
      const account = activeAccounts[i];
      try {
        for (const win of monthlyWindows) {
          const rows = await this.graphGetPaginated<CampaignInsightRow>(
            `/${account.id}/insights`,
            {
              fields:
                'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,' +
                'reach,frequency,cpm,cpc,cpp,ctr,inline_link_clicks,unique_clicks',
              level: 'campaign',
              time_increment: '1',
              time_range: JSON.stringify({
                since: this.toDateStr(win.from),
                until: this.toDateStr(win.to),
              }),
            },
            token,
          );

          for (const row of rows) {
            // Compras: dedup pela chave canônica (omni_purchase prioritário, senão MAIOR
            // valor entre alternativas — nunca soma, evita dobrar faturamento).
            const conversions = dedupPurchaseMetric(row.actions);
            const conversionValue = dedupPurchaseMetric(row.action_values);

            // Mensagens (PRIORIDADE — pedido explícito do dono).
            const messagingConversations = findActionValue(
              row.actions,
              MESSAGING_ACTION_TYPES.conversations,
            );
            const messagingFirstReply = findActionValue(row.actions, MESSAGING_ACTION_TYPES.firstReply);
            const messagingConnections = findActionValue(row.actions, MESSAGING_ACTION_TYPES.connections);
            const messagingOrders = findActionValue(row.actions, MESSAGING_ACTION_TYPES.orders);

            const leads = dedupMaxMetric(row.actions, LEAD_ACTION_TYPES);
            const purchases = conversions; // omni_purchase já é a contagem canônica de compras
            const purchaseValue = conversionValue;
            const postEngagement = findActionValue(row.actions, 'post_engagement');
            const videoViews = findActionValue(row.actions, 'video_view');

            records.push({
              kind: 'ad_metric',
              externalId: `${account.id}:${row.campaign_id}:${row.date_start}`,
              occurredAt: new Date(row.date_start),
              data: {
                provider: 'meta_ads',
                accountId: account.id,
                accountName: account.name,
                currency: account.currency,
                accountStatus: account.account_status,
                campaignId: row.campaign_id,
                campaignName: row.campaign_name,
                date: row.date_start,
                spend: parseFloat(row.spend ?? '0') || 0,
                impressions: parseInt(row.impressions ?? '0', 10) || 0,
                clicks: parseInt(row.clicks ?? '0', 10) || 0,
                conversions,
                conversionValue,
                reach: parseInt(row.reach ?? '0', 10) || 0,
                frequency: parseFloat(row.frequency ?? '0') || 0,
                cpm: parseFloat(row.cpm ?? '0') || 0,
                cpc: parseFloat(row.cpc ?? '0') || 0,
                cpp: parseFloat(row.cpp ?? '0') || 0,
                ctr: parseFloat(row.ctr ?? '0') || 0,
                inlineLinkClicks: parseInt(row.inline_link_clicks ?? '0', 10) || 0,
                uniqueClicks: parseInt(row.unique_clicks ?? '0', 10) || 0,
                messagingConversations,
                messagingFirstReply,
                messagingConnections,
                messagingOrders,
                leads,
                purchases,
                purchaseValue,
                postEngagement,
                videoViews,
              },
            });
          }
        }
      } catch (err) {
        const permanent = (err as Error & { permanent?: boolean }).permanent;
        this.logger.error(
          `Conta ${account.id} (${account.name}) falhou${permanent ? ' [permanente, pulando]' : ''}: ${
            err instanceof Error ? err.message : err
          }`,
        );
        if (!permanent) {
          // Erro transitório esgotou as tentativas: interrompe aqui e retoma
          // desta mesma conta no próximo ciclo (checkpoint).
          return { records, nextCursor: String(i), hasMore: true };
        }
        // Permanente: pula a conta e segue para a próxima.
        continue;
      }
    }

    return { records, hasMore: false };
  }

  private toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Divide o range em janelas mensais (regra Graph API p/ nível conta/campanha). */
  private splitIntoMonthlyWindows(from: Date, to: Date): Array<{ from: Date; to: Date }> {
    const windows: Array<{ from: Date; to: Date }> = [];
    let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

    while (cursor <= end) {
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
      const windowEnd = monthEnd < end ? monthEnd : end;
      windows.push({ from: new Date(cursor), to: new Date(windowEnd) });
      cursor = new Date(Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth(), windowEnd.getUTCDate() + 1));
    }
    return windows.length ? windows : [{ from, to }];
  }
}
