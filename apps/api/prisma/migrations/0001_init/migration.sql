-- Migration inicial (Passo 1) — tabelas do BLUEPRINT seção 2.
-- Gerada para acompanhar o schema.prisma; rode `prisma migrate dev` para
-- regenerar/ajustar conforme evoluir o schema nos próximos passos.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MembershipRole" AS ENUM (
  'ADMIN_GERAL','ADMIN_EMPRESA','FINANCEIRO','GESTOR','ANALISTA','OPERADOR','VISUALIZADOR'
);
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING','ACTIVE','ERROR','DISABLED');
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED','RUNNING','SUCCESS','FAILED');

CREATE TABLE "tenants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "plan" TEXT NOT NULL DEFAULT 'free',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "totp_secret_enc" BYTEA,
  "is_2fa_enabled" BOOLEAN NOT NULL DEFAULT false,
  "last_login_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "memberships" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id"),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "role" "MembershipRole" NOT NULL,
  "invited_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "user_id")
);
CREATE INDEX "ix_memberships_lookup" ON "memberships" ("tenant_id", "user_id");

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id"),
  "refresh_token_hash" TEXT NOT NULL,
  "device_fingerprint" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ix_sessions_user" ON "sessions" ("user_id");

CREATE TABLE "login_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "tenant_id" UUID REFERENCES "tenants"("id"),
  "ip" TEXT,
  "user_agent" TEXT,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ix_login_history_user" ON "login_history" ("user_id", "created_at");

CREATE TABLE "integration_providers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "auth_type" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "integrations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id"),
  "provider_id" UUID NOT NULL REFERENCES "integration_providers"("id"),
  "name" TEXT NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
  "last_sync_at" TIMESTAMP(3),
  "sync_interval_sec" INTEGER NOT NULL DEFAULT 900,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "provider_id", "name")
);
CREATE INDEX "ix_integrations_tenant" ON "integrations" ("tenant_id");

CREATE TABLE "integration_credentials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" UUID NOT NULL UNIQUE REFERENCES "integrations"("id"),
  "ciphertext" BYTEA NOT NULL,
  "key_version" INTEGER NOT NULL,
  "iv" BYTEA NOT NULL,
  "auth_tag" BYTEA NOT NULL,
  "rotated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "sync_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id"),
  "integration_id" UUID NOT NULL REFERENCES "integrations"("id"),
  "trigger" TEXT NOT NULL,
  "status" "SyncStatus" NOT NULL DEFAULT 'QUEUED',
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "records_upserted" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "cursor" TEXT
);
CREATE INDEX "ix_sync_runs" ON "sync_runs" ("tenant_id", "integration_id", "started_at");
