import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  computeFinance,
  FinanceRule,
  FinanceResult,
} from '../domain/finance-calc';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Garante um FinanceConfig para o tenant. */
  async ensureConfig(tenantId: string) {
    return this.prisma.financeConfig.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async addRule(
    tenantId: string,
    rule: {
      kind: 'TAX' | 'FEE' | 'OPCOST';
      name: string;
      calcType: 'PERCENT' | 'FIXED';
      value: number;
    },
  ) {
    const config = await this.ensureConfig(tenantId);
    return this.prisma.financeRule.create({
      data: { financeConfigId: config.id, ...rule },
    });
  }

  async listRules(tenantId: string) {
    const config = await this.ensureConfig(tenantId);
    return this.prisma.financeRule.findMany({
      where: { financeConfigId: config.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Aplica as regras ativas do tenant sobre os totais informados. */
  async compute(
    tenantId: string,
    totals: { valorInvestido: number; receitaBruta: number; taxasGateway: number },
  ): Promise<FinanceResult> {
    const config = await this.ensureConfig(tenantId);
    const dbRules = await this.prisma.financeRule.findMany({
      where: { financeConfigId: config.id, isActive: true },
    });
    const rules: FinanceRule[] = dbRules.map((r) => ({
      kind: r.kind,
      calcType: r.calcType,
      value: Number(r.value),
      isActive: r.isActive,
    }));
    return computeFinance({ ...totals, rules });
  }
}
