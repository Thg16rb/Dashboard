-- Log de atividade da API (requisições HTTP + eventos de webhook).

CREATE TABLE "api_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" TEXT NOT NULL DEFAULT 'http',
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "tenant_id" UUID,
  "ip" TEXT,
  "summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ix_api_logs_time" ON "api_logs" ("created_at");
CREATE INDEX "ix_api_logs_tenant_time" ON "api_logs" ("tenant_id", "created_at");
