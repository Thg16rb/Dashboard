import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Define o tenant do contexto da conexão para ativar as policies de RLS.
   * Usado pelo interceptor de tenant (Passo 3).
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRawUnsafe(
      `SET app.tenant_id = '${tenantId}'`,
    );
  }
}
