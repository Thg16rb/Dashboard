import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './infra/dashboard.controller';
import { DashboardService } from './application/dashboard.service';
import { DashboardGateway } from './infra/dashboard.gateway';

/**
 * DashboardModule — KPIs server-side + tempo real via WebSocket (BLUEPRINT 8).
 */
@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
})
export class DashboardModule {}
