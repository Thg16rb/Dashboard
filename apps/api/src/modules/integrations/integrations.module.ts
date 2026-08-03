import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './infra/integrations.controller';
import { IntegrationsService } from './application/integrations.service';
import { CredentialsService } from './application/credentials.service';
import { IntegrationRegistry } from './application/integration.registry';
import { MetaAdsConnector } from './infra/connectors/meta-ads.connector';
import { StripeConnector } from './infra/connectors/stripe.connector';

/**
 * IntegrationsModule — Adapter + Registry (BLUEPRINT seção 4).
 * Novo provedor = adicionar a classe do connector e registrá-la no array abaixo;
 * o pipeline e o restante da estrutura não mudam.
 */
@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    CredentialsService,
    MetaAdsConnector,
    StripeConnector,
    {
      provide: IntegrationRegistry,
      useFactory: (meta: MetaAdsConnector, stripe: StripeConnector) =>
        new IntegrationRegistry([meta, stripe]),
      inject: [MetaAdsConnector, StripeConnector],
    },
  ],
  exports: [IntegrationRegistry, CredentialsService],
})
export class IntegrationsModule {}
