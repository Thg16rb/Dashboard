import { Module } from '@nestjs/common';
import { WebhooksController } from './infra/webhooks.controller';
import { WebhooksService } from './application/webhooks.service';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * WebhooksModule — recebe vendas dos gateways, valida HMAC por cliente e salva
 * no banco (BLUEPRINT seção 6). Importa IntegrationsModule para acessar as
 * credenciais cifradas (webhookSecret) e o registry de connectors.
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
