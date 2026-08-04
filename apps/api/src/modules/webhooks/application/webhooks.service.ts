import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

interface IncomingSale {
  externalId: string;
  grossAmount: number;
  feeAmount?: number;
  netAmount?: number;
  status: string;
  paymentMethod?: string;
  customerHash?: string;
  utm?: {
    source?: string; medium?: string; campaign?: string; content?: string; term?: string;
  };
  clickId?: string;
  occurredAt?: Date;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Salva a venda recebida do gateway (idempotente por integration+external_id).
   * Guarda os parâmetros de rastreamento para casar com a campanha depois.
   */
  async saveSale(
    tenantId: string,
    integrationId: string,
    sale: IncomingSale,
  ): Promise<{ saved: boolean; duplicate?: boolean }> {
    const gross = sale.grossAmount;
    const fee = sale.feeAmount ?? 0;
    const net = sale.netAmount ?? gross - fee;

    try {
      await this.prisma.sale.create({
        data: {
          tenantId,
          integrationId,
          externalId: sale.externalId,
          grossAmount: gross,
          feeAmount: fee,
          netAmount: net,
          status: sale.status,
          paymentMethod: sale.paymentMethod,
          customerHash: sale.customerHash,
          utmSource: sale.utm?.source,
          utmMedium: sale.utm?.medium,
          utmCampaign: sale.utm?.campaign,
          utmContent: sale.utm?.content,
          utmTerm: sale.utm?.term,
          clickId: sale.clickId,
          occurredAt: sale.occurredAt ?? new Date(),
        },
      });
      return { saved: true };
    } catch (err: unknown) {
      // Violação de unique = venda já registrada (reentrega do gateway). Ignora.
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        return { saved: false, duplicate: true };
      }
      this.logger.error(`Falha ao salvar venda: ${String(err)}`);
      throw err;
    }
  }
}
