import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { WebhooksService } from '../application/webhooks.service';

/**
 * Recebe webhooks dos gateways e salva a venda (BLUEPRINT seção 6).
 * Responde 200 rápido (ack-first). O parse extrai valor + UTM/click id de
 * um payload genérico; parsers específicos por gateway entram em seguida.
 *
 * A rota inclui o integrationId para saber a qual empresa/gateway pertence.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  @Post(':provider/:integrationId')
  @HttpCode(200)
  async receive(
    @Param('provider') provider: string,
    @Param('integrationId') integrationId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    // Descobre o tenant a partir da integração (sem RLS: rota pública de webhook).
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { tenantId: true },
    });
    if (!integration) {
      // Não vaza detalhe; responde 200 para o gateway não reenfileirar infinitamente.
      return { received: true, ignored: 'integration_desconhecida' };
    }

    const sale = normalizeSale(provider, payload);
    if (!sale) return { received: true, ignored: 'evento_sem_venda' };

    const res = await this.webhooks.saveSale(integration.tenantId, integrationId, sale);
    return { received: true, saved: res.saved, duplicate: res.duplicate ?? false };
  }
}

/**
 * Normaliza um payload de gateway para o formato interno de venda.
 * Cobre um formato genérico + campos comuns; parsers dedicados por gateway
 * (Stripe/Hotmart/Kiwify) refinam isto depois.
 */
function normalizeSale(provider: string, p: Record<string, unknown>) {
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
