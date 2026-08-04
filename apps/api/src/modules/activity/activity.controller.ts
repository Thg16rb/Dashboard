import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/infra/jwt-auth.guard';
import { CurrentUser } from '../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../auth/domain/auth.types';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  /** Log de atividade da API (requisições + webhooks) mais recentes. */
  @Get()
  async list(
    @CurrentUser() user: JwtAccessPayload,
    @Query('kind') kind?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    const isMaster = user.role === 'ADMIN_GERAL';
    const rows = await this.prisma.apiLog.findMany({
      where: {
        ...(kind === 'http' || kind === 'webhook' ? { kind } : {}),
        // Admin Geral vê tudo; demais veem só do próprio tenant (+ webhooks sem tenant).
        ...(isMaster ? {} : { OR: [{ tenantId: user.tenantId }, { kind: 'webhook' }] }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true, kind: true, method: true, path: true,
        statusCode: true, durationMs: true, summary: true, createdAt: true,
      },
    });
    return rows;
  }
}
