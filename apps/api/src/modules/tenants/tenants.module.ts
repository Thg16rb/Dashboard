import { Module } from '@nestjs/common';
import { TenantsController } from './infra/tenants.controller';
import { TenantsService } from './application/tenants.service';
import { AuthModule } from '../auth/auth.module';

/**
 * TenantsModule — leitura do tenant e membros, protegido por RBAC + RLS
 * (BLUEPRINT seções 3.1/3.2).
 */
@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
