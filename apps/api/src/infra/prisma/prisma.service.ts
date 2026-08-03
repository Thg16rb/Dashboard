import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { currentTenant } from '../tenant/tenant-context';

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
   * Executa `fn` dentro de uma transação com `app.tenant_id` definido na MESMA
   * conexão, ativando as policies de RLS (BLUEPRINT seção 3.1). O tenant vem do
   * AsyncLocalStorage populado pelo TenantInterceptor; se `explicitTenantId` for
   * passado, tem precedência (usado em jobs de background sem request).
   *
   * Usa set_config parametrizado (não interpola string) — sem risco de injeção.
   */
  async withTenant<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    explicitTenantId?: string,
  ): Promise<T> {
    const tenantId = explicitTenantId ?? currentTenant()?.tenantId;
    if (!tenantId) {
      throw new Error('withTenant chamado sem tenant no contexto');
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
