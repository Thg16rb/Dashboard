import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

/**
 * MasterModule — Painel do Administrador Geral (BLUEPRINT seção 8.4).
 */
@Module({
  imports: [AuthModule],
  controllers: [MasterController],
  providers: [MasterService],
})
export class MasterModule {}
