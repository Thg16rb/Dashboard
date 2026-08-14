import { Controller, DefaultValuePipe, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from '../application/dashboard.service';
import { JwtAuthGuard } from '../../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/infra/permissions.guard';
import { RequirePermissions } from '../../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../../auth/domain/auth.types';
import { PeriodPreset } from '../domain/periods';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('dashboard:read')
  @Get('kpis')
  kpis(
    @CurrentUser() user: JwtAccessPayload,
    @Query('period', new DefaultValuePipe('30d')) period: PeriodPreset,
  ) {
    return this.dashboard.getKpis(user.tenantId, period);
  }

  @RequirePermissions('dashboard:read')
  @Get('campaigns')
  campaigns(
    @CurrentUser() user: JwtAccessPayload,
    @Query('period', new DefaultValuePipe('30d')) period: PeriodPreset,
  ) {
    return this.dashboard.getCampaigns(user.tenantId, period);
  }

  @RequirePermissions('dashboard:read')
  @Get('timeseries')
  timeseries(
    @CurrentUser() user: JwtAccessPayload,
    @Query('period', new DefaultValuePipe('30d')) period: PeriodPreset,
  ) {
    return this.dashboard.getTimeseries(user.tenantId, period);
  }

  @RequirePermissions('dashboard:read')
  @Get('hourly')
  hourly(
    @CurrentUser() user: JwtAccessPayload,
    @Query('period', new DefaultValuePipe('30d')) period: PeriodPreset,
  ) {
    return this.dashboard.getHourly(user.tenantId, period);
  }
}
