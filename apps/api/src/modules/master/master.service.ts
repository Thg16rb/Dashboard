import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../auth/application/token.service';
import { permissionsForRole } from '../auth/domain/permissions';

/**
 * Painel Master — visão global do Administrador Geral (BLUEPRINT seção 8.4).
 * Bypassa o isolamento de tenant (consultas diretas, sem RLS) porque o
 * ADMIN_GERAL opera acima das empresas. Protegido por RBAC (master:read).
 */
@Injectable()
export class MasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Lista todas as empresas com contagem de membros e integrações. */
  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        _count: { select: { memberships: true, integrations: true } },
      },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      createdAt: t.createdAt,
      usuarios: t._count.memberships,
      integracoes: t._count.integrations,
    }));
  }

  /** Métricas agregadas da plataforma. */
  async stats() {
    const [tenants, users, integrations, syncs] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.integration.count(),
      this.prisma.syncRun.count(),
    ]);
    return { empresas: tenants, usuarios: users, integracoes: integrations, sincronizacoes: syncs };
  }

  /**
   * Impersonate: emite um token de acesso com o contexto de outra empresa,
   * mantendo o papel ADMIN_GERAL (para suporte). Registra quem impersonou quem.
   */
  async impersonate(adminUserId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    // Confirma que o solicitante é realmente ADMIN_GERAL em alguma membership.
    const isMaster = await this.prisma.membership.findFirst({
      where: { userId: adminUserId, role: 'ADMIN_GERAL' },
    });
    if (!isMaster) throw new ForbiddenException('Apenas Administrador Geral');

    const accessToken = this.tokens.signAccess({
      sub: adminUserId,
      tenantId,
      role: 'ADMIN_GERAL',
      perms: permissionsForRole('ADMIN_GERAL'),
    });

    return { accessToken, tenant: { id: tenant.id, name: tenant.name } };
  }
}
