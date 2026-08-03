-- Row-Level Security: isolamento multi-tenant (BLUEPRINT seção 3.1)
-- A aplicação executa `SET app.tenant_id = '<uuid>'` por request; o banco
-- bloqueia qualquer acesso cruzado entre empresas como defesa em profundidade.

-- Função helper: lê o tenant do contexto da conexão
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'memberships', 'sessions', 'login_history',
    'integrations', 'sync_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id());
    $f$, t);
  END LOOP;
END $$;

-- Nota: integration_credentials não possui coluna tenant_id (o vínculo é via
-- integrations). Seu isolamento é herdado por join; a policy dedicada será
-- adicionada no Passo 4, junto das tabelas de métricas/vendas particionadas.
