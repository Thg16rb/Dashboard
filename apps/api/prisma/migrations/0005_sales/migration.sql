-- Vendas recebidas via webhook, com rastreamento venda↔campanha (UTM + click id).

CREATE TABLE "sales" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "external_id" TEXT NOT NULL,
  "gross_amount" DECIMAL(14,4) NOT NULL,
  "fee_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "net_amount" DECIMAL(14,4) NOT NULL,
  "status" TEXT NOT NULL,
  "payment_method" TEXT,
  "customer_hash" TEXT,
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "utm_content" TEXT,
  "utm_term" TEXT,
  "click_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotência: mesma venda do mesmo gateway nunca é contada duas vezes.
CREATE UNIQUE INDEX "ux_sales_external" ON "sales" ("integration_id", "external_id");
-- Consultas do dashboard (janela temporal e por campanha).
CREATE INDEX "ix_sales_tenant_time" ON "sales" ("tenant_id", "occurred_at");
CREATE INDEX "ix_sales_tenant_campaign" ON "sales" ("tenant_id", "utm_campaign");

-- RLS: isolamento por empresa (mesma política das demais tabelas).
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sales"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
