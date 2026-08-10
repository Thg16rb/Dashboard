-- Integração real Meta Ads: contas de anúncio, campanhas e insights diários
-- (grão fino, leitura rápida pelo dashboard sem bater na Graph API no request).

-- Checkpoint de retomada de sync (índice da última conta processada antes de
-- bater rate limit) — sync resumível sem perder progresso.
ALTER TABLE "integrations" ADD COLUMN "sync_cursor" TEXT;

CREATE TABLE "meta_ad_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL REFERENCES "integrations"("id"),
  "account_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT,
  "account_status" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_sync_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ux_meta_ad_accounts_integration_account" ON "meta_ad_accounts" ("integration_id", "account_id");
CREATE INDEX "ix_meta_ad_accounts_tenant" ON "meta_ad_accounts" ("tenant_id");

CREATE TABLE "meta_campaigns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "ad_account_id" UUID NOT NULL REFERENCES "meta_ad_accounts"("id"),
  "campaign_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT,
  "objective" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ux_meta_campaigns_account_campaign" ON "meta_campaigns" ("ad_account_id", "campaign_id");
CREATE INDEX "ix_meta_campaigns_tenant" ON "meta_campaigns" ("tenant_id");

CREATE TABLE "meta_campaign_insights" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL REFERENCES "integrations"("id"),
  "ad_account_id" UUID NOT NULL REFERENCES "meta_ad_accounts"("id"),
  "campaign_id" UUID NOT NULL REFERENCES "meta_campaigns"("id"),
  "campaign_external_id" TEXT NOT NULL,
  "campaign_name" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "spend" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "impressions" BIGINT NOT NULL DEFAULT 0,
  "clicks" BIGINT NOT NULL DEFAULT 0,
  "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "conversion_value" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "currency" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Idempotência: upsert por conta+campanha+dia (o mesmo dia nunca duplica).
CREATE UNIQUE INDEX "ux_meta_insight_account_campaign_date" ON "meta_campaign_insights" ("ad_account_id", "campaign_id", "date");
-- Leitura rápida do dashboard: por tenant+data e por tenant+campanha+data.
CREATE INDEX "ix_meta_insights_tenant_date" ON "meta_campaign_insights" ("tenant_id", "date");
CREATE INDEX "ix_meta_insights_tenant_campaign_date" ON "meta_campaign_insights" ("tenant_id", "campaign_external_id", "date");

-- RLS: isolamento por empresa (mesma política das demais tabelas com tenant_id).
ALTER TABLE "meta_ad_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_ad_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meta_ad_accounts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "meta_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meta_campaigns"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "meta_campaign_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_campaign_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meta_campaign_insights"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
