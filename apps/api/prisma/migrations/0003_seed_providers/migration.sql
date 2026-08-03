-- Seed dos providers pré-preparados (BLUEPRINT seção 4.2).
-- Idempotente: ON CONFLICT no code único.

INSERT INTO "integration_providers" ("id","code","name","category","auth_type","is_active")
VALUES
  (gen_random_uuid(), 'meta_ads', 'Meta Ads', 'ads', 'oauth2', true),
  (gen_random_uuid(), 'stripe',   'Stripe',   'gateway', 'api_key', true)
ON CONFLICT ("code") DO NOTHING;
