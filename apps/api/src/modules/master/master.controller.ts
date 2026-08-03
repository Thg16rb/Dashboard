import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { JwtAuthGuard } from '../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../auth/infra/permissions.guard';
import { RequirePermissions } from '../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../auth/domain/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('master:read')
@Controller('master')
export class MasterController {
  constructor(private readonly master: MasterService) {}

  @Get('tenants')
  tenants() {
    return this.master.listTenants();
  }

  @Get('stats')
  stats() {
    return this.master.stats();
  }

  @Post('impersonate/:tenantId')
  impersonate(
    @CurrentUser() user: JwtAccessPayload,
    @Param('tenantId') tenantId: string,
  ) {
    return this.master.impersonate(user.sub, tenantId);
  }
}
