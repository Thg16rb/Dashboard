-- Extensão de métricas Meta Ads: reach, frequência, custos derivados, cliques
-- de link, e MÉTRICAS DE MENSAGENS (conversas iniciadas, primeira resposta,
-- conexões, pedidos via mensagem) + leads, compras, engajamento, video views.
-- Colunas novas ficam com default 0 para o histórico já coletado; um re-sync
-- (script separado) re-busca e faz UPSERT preenchendo os valores reais.

ALTER TABLE "meta_campaign_insights"
  ADD COLUMN "reach" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "frequency" DECIMAL(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN "cpm" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "cpc" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "cpp" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "ctr" DECIMAL(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN "inline_link_clicks" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "unique_clicks" BIGINT NOT NULL DEFAULT 0,
  -- Mensagens (PRIORIDADE — pedido explícito do dono).
  ADD COLUMN "messaging_conversations" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "messaging_first_reply" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "messaging_connections" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "messaging_orders" BIGINT NOT NULL DEFAULT 0,
  -- Leads / compras (dedup: chave canônica, nunca soma de action_types que se repetem).
  ADD COLUMN "leads" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "purchases" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "purchase_value" DECIMAL(14,4) NOT NULL DEFAULT 0,
  -- Engajamento / vídeo.
  ADD COLUMN "post_engagement" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "video_views" BIGINT NOT NULL DEFAULT 0;
