import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantsService } from '../application/tenants.service';
import { JwtAuthGuard } from '../../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/infra/permissions.guard';
import { RequirePermissions } from '../../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../../auth/domain/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @RequirePermissions('tenant:read')
  @Get('me')
  me(@CurrentUser() user: JwtAccessPayload) {
    return this.tenants.getCurrent(user.tenantId);
  }

  @RequirePermissions('user:read')
  @Get('members')
  members(@CurrentUser() user: JwtAccessPayload) {
    return this.tenants.listMembers(user.tenantId);
  }
}
