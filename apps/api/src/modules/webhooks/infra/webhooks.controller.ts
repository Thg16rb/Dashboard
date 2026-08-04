import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { WebhooksService } from '../application/webhooks.service';
import { CredentialsService } from '../../integrations/application/credentials.service';
import { IntegrationRegistry } from '../../integrations/application/integration.registry';
import { diggionpayToSale } from '../../integrations/infra/connectors/diggionpay.connector';

/**
 * Recebe webhooks dos gateways e salva a venda (BLUEPRINT seção 6).
 * Multi-tenant: cada empresa usa seu próprio integrationId na URL e seu próprio
 * webhookSecret — a assinatura HMAC é validada com o secret DAQUELE cliente,
 * então uma empresa nunca aceita venda destinada a outra.
 * Responde 200 rápido (ack-first).
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly credentials: CredentialsService,
    private readonly registry: IntegrationRegistry,
  ) {}

  @Post(':provider/:integrationId')
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Param('integrationId') integrationId: string,
    @Body() payload: Record<string, unknown>,
    @Req() req: FastifyRequest & { rawBody?: string },
  ) {
    // Descobre a integração + tenant (rota pública; não usa RLS).
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { tenantId: true, provider: { select: { code: true } } },
    });
    if (!integration) {
      // Responde 200 para o gateway não reenfileirar infinitamente.
      return { received: true, ignored: 'integration_desconhecida' };
    }

    // Validação HMAC com o webhookSecret DESTE cliente (isolamento por empresa).
    const cred = await this.credentials.get(integrationId);
    const secret = cred?.webhookSecret ?? cred?.secretKey;
    const connector = safeConnector(this.registry, integration.provider.code);

    if (connector?.verifySignature && secret) {
      const raw = req.rawBody ?? JSON.stringify(payload);
      const headers = req.headers as Record<string, string | undefined>;
      const valid = connector.verifySignature(headers, raw, secret);
      if (!valid) {
        // Assinatura inválida → não salva. 200 evita retries agressivos, mas marca ignorado.
        return { received: true, ignored: 'assinatura_invalida' };
      }
    }
    // Se não há secret configurado ainda, aceita (cliente pode configurar depois).

    const sale = normalizeSale(provider, payload);
    if (!sale) return { received: true, ignored: 'evento_sem_venda' };

    const res = await this.webhooks.saveSale(integration.tenantId, integrationId, sale);
    return { received: true, saved: res.saved, duplicate: res.duplicate ?? false };
  }
}

function safeConnector(registry: IntegrationRegistry, code: string) {
  try {
    return registry.get(code);
  } catch {
    return undefined;
  }
}

/**
 * Normaliza um payload de gateway para o formato interno de venda.
 * Cobre um formato genérico + campos comuns; parsers dedicados por gateway
 * (Stripe/Hotmart/Kiwify) refinam isto depois.
 */
function normalizeSale(provider: string, p: Record<string, unknown>) {
  // Parser dedicado da DiggionPay (formato order.completed + metadata).
  if (provider === 'diggionpay') {
    return diggionpayToSale(p);
  }

  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v ? v : undefined;

  // aceita tanto campos "planos" quanto aninhados em data/tracking/utm
  const data = (p.data as Record<string, unknown>) ?? p;
  const tracking = (p.tracking as Record<string, unknown>) ?? (p.utm as Record<string, unknown>) ?? p;

  const externalId = str(p.id) ?? str(data.id) ?? str(p.transaction_id) ?? str(p.order_id);
  const gross = num(p.amount ?? data.amount ?? p.value ?? p.total ?? data.total);
  if (!externalId || gross <= 0) return null;

  return {
    externalId,
    grossAmount: gross,
    feeAmount: num(p.fee ?? data.fee ?? 0),
    status: str(p.status ?? data.status) ?? 'paid',
    paymentMethod: str(p.payment_method ?? data.payment_method),
    utm: {
      source: str(tracking.utm_source ?? tracking.source),
      medium: str(tracking.utm_medium ?? tracking.medium),
      campaign: str(tracking.utm_campaign ?? tracking.campaign),
      content: str(tracking.utm_content ?? tracking.content),
      term: str(tracking.utm_term ?? tracking.term),
    },
    clickId: str(tracking.fbclid ?? tracking.gclid ?? tracking.ttclid ?? tracking.click_id),
    occurredAt: p.occurred_at ? new Date(String(p.occurred_at)) : new Date(),
    provider,
  };
}
