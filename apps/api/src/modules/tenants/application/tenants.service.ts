import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retorna o tenant do contexto atual (RLS garante o isolamento). */
  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, plan: true, status: true },
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    return tenant;
  }

  /** Membros do tenant — consulta escopada por RLS via withTenant. */
  listMembers(tenantId: string) {
    return this.prisma.withTenant(
      (tx) =>
        tx.membership.findMany({
          where: { tenantId },
          select: {
            id: true,
            role: true,
            userId: true,
            createdAt: true,
          },
        }),
      tenantId,
    );
  }
}
