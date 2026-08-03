import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './infra/finance.controller';
import { FinanceService } from './application/finance.service';

/**
 * FinanceModule — regras parametrizáveis + cálculo puro (BLUEPRINT seção 7).
 */
@Module({
  imports: [AuthModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
