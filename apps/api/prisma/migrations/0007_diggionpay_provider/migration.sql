-- Provider DiggionPay (gateway PIX). Idempotente.
INSERT INTO "integration_providers" ("id","code","name","category","auth_type","is_active")
VALUES (gen_random_uuid(), 'diggionpay', 'DiggionPay', 'gateway', 'api_key', true)
ON CONFLICT ("code") DO NOTHING;
