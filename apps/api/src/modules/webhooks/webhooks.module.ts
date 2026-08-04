import { Module } from '@nestjs/common';
import { WebhooksController } from './infra/webhooks.controller';
import { WebhooksService } from './application/webhooks.service';

/**
 * WebhooksModule — recebe vendas dos gateways e salva no banco (BLUEPRINT seção 6).
 */
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
