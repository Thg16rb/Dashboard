import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IntegrationsService } from '../application/integrations.service';
import { JwtAuthGuard } from '../../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/infra/permissions.guard';
import { RequirePermissions } from '../../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../../auth/domain/auth.types';
import { CreateIntegrationDto, SetCredentialsDto } from './dto/integrations.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @RequirePermissions('integration:read')
  @Get('providers')
  providers() {
    return this.integrations.availableProviders();
  }

  @RequirePermissions('integration:read')
  @Get()
  list(@CurrentUser() user: JwtAccessPayload) {
    return this.integrations.list(user.tenantId);
  }

  @RequirePermissions('integration:write')
  @Post()
  create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrations.create(user.tenantId, dto.providerCode, dto.name);
  }

  @RequirePermissions('integration:write')
  @Post(':id/credentials')
  setCredentials(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: SetCredentialsDto,
  ) {
    return this.integrations.setCredentials(user.tenantId, id, dto.credentials);
  }
}
