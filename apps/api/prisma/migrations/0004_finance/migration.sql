-- Módulo financeiro (BLUEPRINT seção 7).

CREATE TYPE "FinanceRuleKind" AS ENUM ('TAX','FEE','OPCOST');
CREATE TYPE "FinanceCalcType" AS ENUM ('PERCENT','FIXED');

CREATE TABLE "finance_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL UNIQUE REFERENCES "tenants"("id"),
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "finance_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "finance_config_id" UUID NOT NULL REFERENCES "finance_configs"("id"),
  "kind" "FinanceRuleKind" NOT NULL,
  "name" TEXT NOT NULL,
  "calc_type" "FinanceCalcType" NOT NULL,
  "value" DECIMAL(9,4) NOT NULL,
  "applies_to" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ix_finance_rules" ON "finance_rules" ("finance_config_id", "is_active");

-- RLS por herança de tenant via finance_configs (join). Policy direta em
-- finance_configs:
ALTER TABLE "finance_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "finance_configs"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
