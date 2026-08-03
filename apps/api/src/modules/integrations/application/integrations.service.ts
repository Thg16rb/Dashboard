import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CredentialsService } from './credentials.service';
import { IntegrationRegistry } from './integration.registry';
import { DecryptedCredential } from '../domain/connector';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
    private readonly credentials: CredentialsService,
  ) {}

  /** Catálogo de connectors disponíveis (pré-preparados). */
  availableProviders() {
    return this.registry.list().map((c) => ({
      code: c.code,
      category: c.category,
      authType: c.authType,
    }));
  }

  list(tenantId: string) {
    return this.prisma.withTenant(
      (tx) =>
        tx.integration.findMany({
          where: { tenantId },
          select: {
            id: true,
            name: true,
            status: true,
            lastSyncAt: true,
            provider: { select: { code: true, category: true } },
          },
        }),
      tenantId,
    );
  }

  async create(
    tenantId: string,
    providerCode: string,
    name: string,
  ) {
    // valida que o connector existe
    this.registry.get(providerCode);
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { code: providerCode },
    });
    if (!provider) throw new NotFoundException('Provider não cadastrado');

    return this.prisma.withTenant(
      (tx) =>
        tx.integration.create({
          data: { tenantId, providerId: provider.id, name },
          select: { id: true, name: true, status: true },
        }),
      tenantId,
    );
  }

  /** Salva credenciais após validá-las com o connector. */
  async setCredentials(
    tenantId: string,
    integrationId: string,
    cred: DecryptedCredential,
  ) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
      include: { provider: true },
    });
    if (!integration) throw new NotFoundException('Integração não encontrada');

    const connector = this.registry.get(integration.provider.code);
    const result = await connector.validateCredentials(cred);
    if (!result.valid) {
      throw new BadRequestException(result.message ?? 'Credenciais inválidas');
    }

    await this.credentials.upsert(integrationId, cred);
    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'ACTIVE' },
    });
    return { status: 'ACTIVE' };
  }
}
