import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FinanceService } from '../application/finance.service';
import { JwtAuthGuard } from '../../auth/infra/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/infra/permissions.guard';
import { RequirePermissions } from '../../auth/infra/require-permissions.decorator';
import { CurrentUser } from '../../auth/infra/current-user.decorator';
import { JwtAccessPayload } from '../../auth/domain/auth.types';
import { CreateRuleDto } from './dto/finance.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @RequirePermissions('finance:read')
  @Get('rules')
  listRules(@CurrentUser() user: JwtAccessPayload) {
    return this.finance.listRules(user.tenantId);
  }

  @RequirePermissions('finance:write')
  @Post('rules')
  addRule(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateRuleDto) {
    return this.finance.addRule(user.tenantId, dto);
  }
}
