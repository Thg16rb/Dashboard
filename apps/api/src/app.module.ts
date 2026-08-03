import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { TenantInterceptor } from './infra/tenant/tenant.interceptor';
import { PrismaModule } from './infra/prisma/prisma.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './infra/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SyncModule } from './modules/sync/sync.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MasterModule } from './modules/master/master.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    PrismaModule,
    CryptoModule,
    RedisModule,
    HealthModule,
    // Módulos de domínio (esqueleto — lógica nos próximos passos)
    AuthModule,
    TenantsModule,
    UsersModule,
    IntegrationsModule,
    SyncModule,
    FinanceModule,
    WebhooksModule,
    DashboardModule,
    MasterModule,
  ],
  providers: [
    // Popula o contexto de tenant (RLS) em todo request autenticado.
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
