import {
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SyncService } from '../application/sync.service';
import { JwtAuthGuard } from '../../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/infra/permissions.guard';
import { RequirePermissions } from '../../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../../auth/domain/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** "Atualizar Agora" — enfileira e retorna 202 imediatamente. */
  @RequirePermissions('sync:run')
  @Post('integrations/:id/now')
  @HttpCode(202)
  async now(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') integrationId: string,
  ) {
    await this.sync.updateNow(user.tenantId, integrationId);
    return { accepted: true };
  }
}
