# TrafficIntel — Blueprint Técnico

> SaaS B2B multi-tenant de inteligência para tráfego pago e gestão financeira.
> Centraliza campanhas de mídia paga, vendas de gateways e financeiro de centenas de empresas em um único dashboard, em tempo real.

**Stack fixa:** Next.js + React + TypeScript · NestJS + Fastify · PostgreSQL · Redis · BullMQ · WebSockets · Prisma · Docker · Kubernetes-ready.

---

## 1. Visão geral da arquitetura

### 1.1 Componentes do sistema

| Camada | Componente | Responsabilidade |
|---|---|---|
| **Edge** | API Gateway / Ingress (NGINX + WAF) | TLS, rate limit L7, roteamento, CORS, headers de segurança |
| **Frontend** | `web` (Next.js App Router) | Dashboard SSR/CSR, WebSocket client, RSC para telas pesadas |
| **Backend API** | `api` (NestJS + Fastify) | REST + auth + orquestração de casos de uso (stateless, N réplicas) |
| **Realtime** | `ws-gateway` (NestJS WebSocket + Redis adapter) | Push de KPIs para o dashboard sem reload |
| **Workers** | `sync-worker`, `webhook-worker`, `finance-worker` (BullMQ) | Sincronização, processamento de webhooks, recálculo financeiro |
| **Scheduler** | `scheduler` (BullMQ repeatable jobs) | Enfileira sync a cada 15 min por integração ativa |
| **Integrações** | `mcp-*` (adapters) | Contrato uniforme por provedor (Meta, Google, Stripe, Hotmart…) |
| **Dados** | PostgreSQL (primary + read replicas) | Fonte da verdade, particionado por tempo |
| **Cache/Fila** | Redis (Cluster) | Cache de agregações, BullMQ, pub/sub do WS, rate limit distribuído |
| **Observabilidade** | OpenTelemetry → Prometheus/Grafana/Loki/Tempo | Métricas, logs, traces, alertas do Painel Master |
| **Secrets** | Vault / KMS | Criptografia de credenciais, rotação de chaves |

### 1.2 Comunicação entre componentes

- **Frontend ↔ API:** HTTPS/REST (JSON) + JWT no header. Mutations idempotentes com `Idempotency-Key`.
- **Frontend ↔ Realtime:** WebSocket autenticado por JWT de curta duração; canais por `tenant_id`.
- **API → Workers:** enfileiramento em BullMQ (Redis). API nunca faz I/O de integração no request path.
- **Workers → Integrações:** adapters MCP com circuit breaker + retry + rate limit por provedor.
- **Workers → Postgres:** escrita em `UPSERT` idempotente; emite evento no Redis pub/sub.
- **Redis pub/sub → ws-gateway → Frontend:** propagação em tempo real das métricas recalculadas.
- **Gateways externos → API (`/webhooks`):** ingestão HMAC-validada, resposta `2xx` imediata, processamento assíncrono.

### 1.3 Diagrama (ASCII)

```
                              ┌───────────────────────────────┐
   Browsers  ───HTTPS/WSS──▶  │      Ingress + WAF + TLS       │
                              └───────────────┬───────────────┘
                          ┌───────────────────┼────────────────────┐
                          ▼                   ▼                    ▼
                 ┌───────────────┐   ┌─────────────────┐   ┌──────────────┐
                 │  web (Next)   │   │  api (NestJS)   │   │ ws-gateway   │
                 │  SSR/RSC/CSR  │   │  Fastify + JWT  │   │ (Redis adptr)│
                 └───────┬───────┘   └───────┬─────────┘   └──────┬───────┘
                         │  REST/JSON        │ enqueue           │ pub/sub
                         └────────▶──────────┤                   ▲
                                             ▼                   │
                                    ┌─────────────────┐   ┌──────┴───────┐
                                    │   Redis Cluster │◀──│  BullMQ jobs │
                                    │ cache│fila│pub/sub│  └──────┬───────┘
                                    └───┬─────────────┬┘         │
                                        │             │          ▼
                     ┌──────────────────┘             │   ┌──────────────────────┐
                     ▼                                │   │  Workers              │
            ┌──────────────┐                          │   │  sync│webhook│finance │
            │  Scheduler   │──15min──▶ enqueue sync ──┘   └──────┬────────────────┘
            └──────────────┘                                     │ MCP adapters
                                                                 ▼
   Webhooks (gateways) ──HMAC──▶ api/webhooks ──enqueue──▶ ┌───────────────────────┐
                                                           │ Meta│Google│TikTok│…  │
                                                           │ Stripe│Hotmart│Asaas… │
                                                           └───────────┬───────────┘
                                                                       ▼
                                              ┌────────────────────────────────────┐
                                              │  PostgreSQL (primary + N replicas)  │
                                              │  particionado por tempo · RLS       │
                                              └────────────────────────────────────┘
                     Observabilidade: OTel ▶ Prometheus/Grafana/Loki/Tempo ▶ Painel Master
                     Secrets/Crypto: Vault/KMS (AES-256-GCM, rotação de chaves)
```

### ✅ Decisão da seção 1
Arquitetura de **microsserviços orientada a filas com CQRS leve**: o request path é sempre rápido (lê cache/replica), e todo I/O externo é assíncrono via BullMQ. Justificativa: garante resposta < 500 ms independentemente da latência dos provedores externos, isola falhas por tenant/provedor (circuit breaker) e escala horizontalmente cada componente de forma independente no Kubernetes.

---

## 2. Modelo de dados (PostgreSQL)

Convenções: PK `uuid` (`gen_random_uuid()`); `tenant_id` em toda tabela de negócio; timestamps `created_at`/`updated_at`; soft-delete `deleted_at`; tabelas de métricas **particionadas por RANGE(date)**.

### 2.1 Entidades principais (campos-chave)

```sql
-- Empresa (tenant)
tenants(id PK, name, slug UNIQUE, status, plan, created_at, deleted_at)

-- Usuário (global; vínculo com tenant via membership)
users(id PK, email UNIQUE CITEXT, password_hash, totp_secret_enc,
      is_2fa_enabled, last_login_at, status, created_at)

memberships(id PK, tenant_id FK, user_id FK, role, invited_by,
            created_at, UNIQUE(tenant_id, user_id))

-- Sessões / dispositivos
sessions(id PK, user_id FK, tenant_id FK, refresh_token_hash,
         device_fingerprint, ip, user_agent, expires_at, revoked_at, created_at)
login_history(id PK, user_id FK, tenant_id FK, ip, user_agent, success, created_at)

-- Integrações (catálogo + instância por tenant)
integration_providers(id PK, code UNIQUE, name, category, auth_type, is_active)
integrations(id PK, tenant_id FK, provider_id FK, name, status,
             last_sync_at, sync_interval_sec, created_at, UNIQUE(tenant_id, provider_id, name))

-- Credenciais (criptografadas — nunca em texto puro)
integration_credentials(id PK, integration_id FK UNIQUE, ciphertext BYTEA,
                        key_version INT, iv BYTEA, auth_tag BYTEA,
                        rotated_at, created_at)

-- Sincronizações (histórico de execução)
sync_runs(id PK, tenant_id FK, integration_id FK, trigger, status,
          started_at, finished_at, records_upserted, error, cursor)

-- Campanhas e métricas (particionadas)
campaigns(id PK, tenant_id FK, integration_id FK, external_id, name,
          status, objective, created_at, UNIQUE(integration_id, external_id))
ad_metrics(id, tenant_id FK, campaign_id FK, date DATE, spend NUMERIC(14,4),
           impressions BIGINT, clicks BIGINT, conversions BIGINT, revenue NUMERIC(14,4),
           PRIMARY KEY(id, date)) PARTITION BY RANGE(date)

-- Vendas (gateways de pagamento)
sales(id, tenant_id FK, integration_id FK, external_id, gross_amount NUMERIC(14,4),
      fee_amount NUMERIC(14,4), net_amount NUMERIC(14,4), status, customer_hash,
      occurred_at TIMESTAMPTZ, PRIMARY KEY(id, occurred_at)) PARTITION BY RANGE(occurred_at)

-- Webhooks
webhook_endpoints(id PK, tenant_id FK, provider_id FK, url, secret_enc,
                  hmac_algo, version, is_active, created_at)
webhook_events(id, tenant_id FK, endpoint_id FK, event_type, payload JSONB,
               signature, status, attempts, next_retry_at, received_at TIMESTAMPTZ,
               PRIMARY KEY(id, received_at)) PARTITION BY RANGE(received_at)

-- Configuração financeira
finance_configs(id PK, tenant_id FK UNIQUE, currency, created_at)
finance_rules(id PK, finance_config_id FK, kind, -- tax | fee | opcost
              name, calc_type, -- percent | fixed
              value NUMERIC(9,4), applies_to, is_active)

-- Auditoria
audit_logs(id, tenant_id, actor_user_id, action, entity, entity_id,
           diff JSONB, ip, created_at TIMESTAMPTZ,
           PRIMARY KEY(id, created_at)) PARTITION BY RANGE(created_at)
```

### 2.2 Índices para performance

```sql
-- Filtro multi-tenant + janela temporal (o padrão de acesso do dashboard)
CREATE INDEX ix_admetrics_tenant_date   ON ad_metrics (tenant_id, date DESC);
CREATE INDEX ix_admetrics_campaign_date ON ad_metrics (campaign_id, date DESC);
CREATE INDEX ix_sales_tenant_time       ON sales (tenant_id, occurred_at DESC);
CREATE INDEX ix_sales_status            ON sales (tenant_id, status, occurred_at DESC);

-- Deduplicação idempotente na ingestão
CREATE UNIQUE INDEX ux_sales_external   ON sales (integration_id, external_id);
CREATE UNIQUE INDEX ux_campaign_external ON campaigns (integration_id, external_id);

-- Fila de retry de webhooks
CREATE INDEX ix_webhook_retry ON webhook_events (status, next_retry_at)
  WHERE status IN ('pending','failed');

-- Sessões e auth
CREATE INDEX ix_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_memberships_lookup   ON memberships (tenant_id, user_id);

-- Auditoria por entidade
CREATE INDEX ix_audit_entity ON audit_logs (tenant_id, entity, entity_id, created_at DESC);
```

### ✅ Decisão da seção 2
**Coluna `tenant_id` em toda tabela + particionamento por tempo (RANGE) nas tabelas de alto volume** (`ad_metrics`, `sales`, `webhook_events`, `audit_logs`). Justificativa: partições mensais mantêm o índice quente pequeno (queries do dashboard tocam poucas partições), habilitam `DROP PARTITION` para retenção/LGPD sem `DELETE` custoso, e `NUMERIC(14,4)` evita erro de ponto flutuante no financeiro. Chaves `UNIQUE(integration_id, external_id)` tornam toda ingestão idempotente por design.

---

## 3. Multi-tenancy e RBAC

### 3.1 Estratégia de isolamento — decisão: **coluna `tenant_id` + PostgreSQL Row-Level Security (RLS)**

Descartado *schema-per-tenant* (centenas de empresas → milhares de schemas inviabilizam migrations e connection pooling) e *database-per-tenant* (custo operacional proibitivo). Adotado modelo de **coluna discriminadora com RLS** como rede de segurança no nível do banco:

```sql
ALTER TABLE ad_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ad_metrics
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

A cada request, um interceptor NestJS executa `SET app.tenant_id = $tenant` na conexão. Mesmo que um bug no ORM esqueça o `WHERE tenant_id`, o banco bloqueia vazamento entre empresas. **Independência total garantida em duas camadas** (aplicação + RLS).

### 3.2 Papéis (RBAC hierárquico)

| Papel | Escopo | Permissões-chave |
|---|---|---|
| **Administrador Geral** | Plataforma | Painel Master, todos os tenants, infra, auditoria global |
| **Administrador da Empresa** | Tenant | Gerencia usuários, integrações, financeiro, tudo do tenant |
| **Financeiro** | Tenant | Config financeira, relatórios de lucro/imposto, sem gerir usuários |
| **Gestor** | Tenant | Campanhas, dashboards, criação de metas; sem financeiro sensível |
| **Analista** | Tenant | Leitura + análises, exportação; sem edição de config |
| **Operador** | Tenant | Dispara sync, gerencia webhooks; sem dados financeiros |
| **Visualizador** | Tenant | Somente leitura do dashboard |

Permissões declaradas como `resource:action` (ex.: `finance:read`, `integration:write`) e verificadas por um `PermissionsGuard`. Papéis mapeiam para conjuntos de permissões (evita checagem por string de papel).

### 3.3 Fluxo de autenticação (JWT + Refresh + 2FA)

```
POST /auth/login (email, senha)
  └─ valida hash (argon2id) → se 2FA on → retorna challenge (pending_2fa token)
POST /auth/2fa (código TOTP)
  └─ valida TOTP → emite:
       Access JWT  (15 min, contém sub, tenant_id, role, perms)
       Refresh token (30 dias, opaco, hash em sessions, rotacionado a cada uso)
  └─ registra login_history + cria session (device_fingerprint, ip, ua)
POST /auth/refresh  → rotação de refresh (detecção de reuso = revoga toda a família)
POST /auth/logout   → revoga session atual
```

### 3.4 Sessões ativas e dispositivos
- Tela "Sessões ativas": lista `sessions` não revogadas com dispositivo, IP, localização aproximada, último acesso; botão **revogar** individual ou **encerrar todas as outras**.
- Reuso de refresh token → revoga a família inteira (proteção contra roubo de token).
- Access token de vida curta (15 min) minimiza janela de comprometimento; permissões viajam no JWT para evitar hit no banco a cada request.

### ✅ Decisão da seção 3
**`tenant_id` + RLS + JWT curto com refresh rotativo e 2FA TOTP obrigatório para papéis administrativos.** Justificativa: RLS entrega isolamento defense-in-depth sem o custo operacional de schema/DB por tenant; refresh rotativo com detecção de reuso é o padrão OWASP para sessões; permissões no JWT mantêm o hot path sem I/O extra, sustentando o SLA de < 500 ms.

---

## 4. Camada de integrações (MCPs)

### 4.1 Contrato padrão — toda integração implementa a mesma interface

```typescript
interface IntegrationConnector {
  readonly code: string;                       // 'meta_ads', 'stripe'…
  readonly category: 'ads' | 'gateway';
  readonly authType: 'oauth2' | 'api_key' | 'webhook';

  validateCredentials(cred: DecryptedCredential): Promise<ValidationResult>;
  // Sincronização incremental e retomável (cursor-based)
  fetch(ctx: SyncContext): Promise<SyncBatch>;  // usa ctx.cursor, ctx.window
  normalize(raw: unknown): NormalizedRecord[];  // → schema canônico interno
  // Webhooks (gateways)
  verifySignature?(headers, body, secret): boolean;
  parseEvent?(payload: unknown): NormalizedEvent;
}

interface SyncContext { tenantId; integrationId; cursor?; window: DateRange; }
interface SyncBatch { records: NormalizedRecord[]; nextCursor?; hasMore: boolean; }
```

Cada connector é registrado num `IntegrationRegistry` via **Dependency Injection**. O `sync-worker` nunca conhece um provedor específico — só o contrato. Isso satisfaz o Open/Closed Principle: adicionar provedor = adicionar classe, sem tocar no pipeline.

### 4.2 Integrações previstas

- **Ads:** Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads, Pinterest Ads, X Ads, Taboola.
- **Gateways:** Mercado Pago, Pagar.me, Asaas, Stripe, Hotmart, Kiwify, PerfectPay, AppMax.

Cada empresa insere suas próprias credenciais; os connectors ficam **pré-preparados** — o tenant só preenche credenciais e a sincronização inicia. Estado por integração é independente (`integrations.status`, `sync_runs`, circuit breaker por `integration_id`).

### 4.3 Processo para adicionar nova integração (sem tocar na estrutura)

1. Criar `NewProviderConnector implements IntegrationConnector` no módulo `integrations/connectors/`.
2. Registrar no `IntegrationRegistry` (uma linha de DI).
3. Inserir linha em `integration_providers` (seed/migration).
4. Mapear campos raw → schema canônico no `normalize()`.
5. Pronto — scheduler, workers, dashboard e financeiro funcionam sem alteração.

### ✅ Decisão da seção 4
**Padrão Adapter + Registry sob um contrato único (`IntegrationConnector`), com sincronização incremental por cursor.** Justificativa: desacopla o pipeline dos provedores (Clean Architecture — o domínio depende de abstração, não de SDK externo), permite adicionar as 15 integrações e futuras sem regressão, e o cursor garante sync retomável após falha sem reprocessar tudo.

---

## 5. Pipeline de sincronização (BullMQ)

### 5.1 Filas e responsabilidades

| Fila | Produtor | Consumidor | Concorrência |
|---|---|---|---|
| `sync:schedule` | Scheduler (repeatable, 15 min) | fan-out por integração ativa | 1 |
| `sync:fetch` | schedule / botão manual | `sync-worker` | N (rate-limit por provedor) |
| `finance:recalc` | sync-worker / mudança de config | `finance-worker` | N |
| `realtime:push` | qualquer worker | `ws-gateway` | N |

### 5.2 Agendamento de 15 min + "Atualizar Agora"

```typescript
// Job repetível — enfileira um fetch por integração ativa
scheduler.add('fanout', {}, { repeat: { every: 15 * 60 * 1000 } });

// Botão "Atualizar Agora" — alta prioridade, deduplicado
queue.add('fetch', { integrationId }, {
  priority: 1,
  jobId: `manual:${integrationId}`,   // dedup: 1 sync manual em voo por integração
  attempts: 5, backoff: { type: 'exponential', delay: 5000 },
});
```

O botão manual **não compete** com o request path do dashboard: ele apenas enfileira; a resposta HTTP volta imediata (`202 Accepted`) e o resultado chega via WebSocket. `jobId` determinístico evita enxurrada de syncs se o usuário clicar várias vezes.

### 5.3 Escrita no Postgres + cache Redis + WebSocket

```
fetch → normalize → UPSERT em campaigns/ad_metrics/sales (idempotente)
      → invalida cache Redis das agregações do tenant (chave por período)
      → enfileira finance:recalc
      → recalc grava KPIs agregados → SETEX no Redis (TTL curto)
      → publica no canal Redis tenant:{id}:metrics
      → ws-gateway entrega ao browser → dashboard atualiza sem reload
```

Estratégia de cache: **write-through nas agregações** (`kpi:{tenant}:{period}` com TTL de 60 s + invalidação ativa no upsert). Leituras do dashboard batem no Redis; miss cai para read replica. Isso sustenta < 500 ms mesmo com centenas de tenants.

### ✅ Decisão da seção 5
**Scheduler com repeatable jobs faz fan-out para uma fila `sync:fetch` concorrente e rate-limited por provedor; escrita idempotente + cache write-through + push via Redis pub/sub.** Justificativa: separa agendamento de execução (escala independente), o `jobId` determinístico elimina duplicação do "Atualizar Agora", e a combinação cache+pub/sub entrega tempo real sem sobrecarregar o Postgres nem o front.

---

## 6. Gestão de Webhooks

### 6.1 Fluxo de recebimento e validação HMAC

```
POST /webhooks/:provider/:endpointId
  1. Lê raw body (sem parse prévio — necessário p/ HMAC)
  2. Recalcula HMAC(secret, raw) e compara em tempo constante (timingSafeEqual)
     └─ inválido → 401 (não enfileira)
  3. Idempotência: se (endpoint_id, event_id) já existe → 200 (no-op)
  4. Persiste webhook_events (status='pending', payload JSONB)
  5. Responde 200 imediatamente (< 100 ms)  ← evita timeout do provedor
  6. Enfileira em webhook:process
```

### 6.2 Persistência, retry e replay

- **Tentativas automáticas:** BullMQ `attempts: 8`, backoff exponencial com jitter; falhas finais → `status='failed'` + alerta no Painel Master.
- **Replay:** endpoint `POST /webhooks/events/:id/replay` reenfileira o evento persistido (payload original preservado) — útil após corrigir bug de processamento.
- **Versionamento:** `webhook_endpoints.version` permite evoluir o parser sem quebrar eventos antigos.
- **Logs e monitoramento:** cada evento expõe timeline (recebido → tentativas → sucesso/falha) na UI.
- **Tempo real:** evento processado com sucesso → mesmo pipeline `finance:recalc` + pub/sub → dashboard atualiza.

### 6.3 Gerenciamento (CRUD)
UI para cadastrar/editar endpoints, rotacionar secret, ativar/desativar, ver logs filtrados por status/tipo, e disparar replay em lote.

### ✅ Decisão da seção 6
**Ack-first com validação HMAC em tempo constante, persistência antes do processamento e replay a partir do payload armazenado.** Justificativa: responder 200 rápido evita reentregas dos gateways; persistir antes de processar garante zero perda de evento e habilita replay/auditoria; idempotência por `(endpoint, event_id)` impede contabilizar a mesma venda duas vezes — crítico para a integridade financeira.

---

## 7. Módulo financeiro

### 7.1 Modelo de dados
`finance_configs` (1 por tenant) + `finance_rules` (N regras). Cada regra tem `kind` (`tax` | `fee` | `opcost`), `calc_type` (`percent` | `fixed`) e `value`. Regras são versionadas por `is_active` + histórico para não recalcular retroativamente relatórios já fechados.

### 7.2 Regras exatas de cálculo

Para um período/tenant:

```
valor_investido   = Σ ad_metrics.spend                         (todas as plataformas de ads)
receita_bruta     = Σ sales.gross_amount                       (vendas aprovadas)
taxas_gateway     = Σ sales.fee_amount                         (taxa real do gateway)

valor_imposto     = Σ (receita_bruta * regra.value)            para cada regra kind='tax' (percent)
                  + Σ regra.value                              para cada regra kind='tax' (fixed)

custos_operacionais = Σ (base * regra.value | regra.value)     regras kind='opcost'

custo_total       = valor_investido + taxas_gateway + valor_imposto + custos_operacionais
lucro_bruto       = receita_bruta - valor_investido
lucro_liquido     = receita_bruta - custo_total
margem_liquida    = lucro_liquido / receita_bruta
```

Todos os valores em `NUMERIC(14,4)`; arredondamento só na apresentação (2 casas). Cálculo roda no `finance-worker` (determinístico, testável) e o resultado agregado é cacheado por período.

### ✅ Decisão da seção 7
**Regras financeiras parametrizáveis por tenant (percent/fixed) com o pipeline de cálculo isolado em um domínio puro e determinístico.** Justificativa: separar *dados* (regras no banco) de *lógica* (função pura) permite que cada empresa configure impostos/taxas sem deploy, torna o cálculo 100% testável (unit tests sobre a função) e o resultado cacheado reflete-se identicamente em dashboard e relatórios — uma única fonte da verdade financeira.

---

## 8. Dashboard e Painel Master

### 8.1 KPIs e fórmulas

| KPI | Fórmula |
|---|---|
| ROI | `lucro_liquido / valor_investido` |
| ROAS | `receita_bruta / valor_investido` |
| CPA | `valor_investido / conversões` |
| CPL | `valor_investido / leads` |
| CPM | `valor_investido / impressões × 1000` |
| CTR | `clicks / impressões` |
| CAC | `valor_investido / novos_clientes` |
| LTV | `ticket_médio × frequência × tempo_retenção` |
| Ticket Médio | `receita_bruta / conversões` |
| Margem | `lucro_liquido / receita_bruta` |

Mais: Investimento, Receita Bruta/Líquida, Lucro, Conversões.

### 8.2 Comparação por períodos
Hoje, Ontem, 7/30/90/365 dias e personalizado — cada card exibe valor + variação % vs. período anterior equivalente. Cálculo server-side sobre partições, cacheado por `(tenant, período)`.

### 8.3 Estrutura das telas (por nível de acesso)
- **Visão geral:** cards de KPI + gráficos de tendência + tabela por campanha/plataforma.
- **Financeiro:** breakdown de custo/imposto/lucro (visível a Admin Empresa + Financeiro).
- **Integrações/Webhooks:** status, últimas syncs, logs (Operador/Admin).
- **RBAC na UI:** cada widget respeita `perms` do JWT; Visualizador vê só leitura, Operador não vê financeiro.

### 8.4 Painel Master (Administrador Geral)
Empresas ativas, usuários online (via WS presence), consumo de APIs por provedor, saúde do Redis, profundidade das filas BullMQ, taxa de falha de webhooks, CPU/memória/DB, latência p95/p99, logs, auditoria e erros — alimentado por Prometheus/Grafana embutido + queries agregadas.

### ✅ Decisão da seção 8
**KPIs calculados server-side sobre dados particionados e cacheados por período, com renderização condicionada às permissões do JWT; Painel Master alimentado pela stack de observabilidade (OTel/Prometheus).** Justificativa: cálculo no servidor garante consistência entre usuários e evita expor dados brutos ao cliente; reaproveitar a telemetria já coletada para o Master evita construir um sistema de métricas paralelo.

---

## 9. Segurança e conformidade

| Controle exigido | Aplicação prática |
|---|---|
| **OWASP Top 10** | Validação/serialização (class-validator + Zod), queries parametrizadas (Prisma), output encoding, CSP, headers (helmet) |
| **SQL Injection** | ORM parametrizado + RLS; zero SQL string-concatenado |
| **XSS** | React escapa por padrão + CSP restritiva + sanitização de HTML dinâmico |
| **CSRF** | JWT em header (não cookie de sessão) + SameSite nos poucos cookies + double-submit onde aplicável |
| **Criptografia AES** | Credenciais/secrets em `AES-256-GCM`; chave no KMS/Vault; `key_version` por registro |
| **Rotação de chaves** | Nova `key_version`; re-encrypt lazy no próximo uso; chaves antigas retidas até migração completa |
| **HTTPS** | TLS 1.3 no ingress, HSTS, redirect 80→443 |
| **Rate limit** | Redis token-bucket por IP + por tenant + por rota sensível |
| **Auditoria** | `audit_logs` imutável (append-only, particionado) para toda ação sensível |
| **Backups** | PITR do Postgres + snapshots diários criptografados, testados por restore periódico |
| **LGPD** | Minimização (`customer_hash` em vez de PII crua), export/erasure por tenant via `DROP PARTITION`/anonimização, consentimento e base legal registrados, DPA por integração |
| **Proteção de credenciais** | Nunca em log/response; decriptadas só na memória do worker no momento do uso; mascaradas na UI |

### ✅ Decisão da seção 9
**Defense-in-depth: criptografia AES-256-GCM com rotação por versão de chave, RLS no banco, rate limit distribuído e auditoria append-only particionada, com LGPD tratada por design (hash de PII + erasure via partição).** Justificativa: nenhum controle único protege sozinho; a combinação cobre o OWASP Top 10 e atende à LGPD sem penalizar performance, já que criptografia e auditoria ficam fora do hot path de leitura do dashboard.

---

## 10. Escalabilidade e plano de implementação

### 10.1 Dimensionamento (milhares de usuários, centenas de tenants)
- **API/ws-gateway/workers:** stateless → HPA no Kubernetes por CPU + profundidade de fila.
- **Postgres:** primary para escrita + read replicas para dashboard; particionamento por tempo mantém índices quentes pequenos; PgBouncer para pooling.
- **Redis:** Cluster para cache + filas + pub/sub; WS escala horizontal com Redis adapter.
- **BullMQ:** concorrência e rate-limit por provedor evitam ban de API externa; DLQ para falhas.
- **Meta de latência:** cache write-through + replicas mantêm leituras < 500 ms sob carga.

### 10.2 Fases de entrega

| Fase | Escopo | Esforço relativo |
|---|---|---|
| **MVP** | Auth (JWT+2FA), multi-tenant+RLS, 2 ads (Meta, Google) + 2 gateways (Stripe, Mercado Pago), sync 15 min, dashboard core (KPIs + períodos), financeiro básico | **≈ 45%** |
| **v1** | Todas as 15 integrações, webhooks completos (HMAC/retry/replay), tempo real via WS, financeiro configurável completo, RBAC de 7 papéis, sessões/dispositivos | **≈ 35%** |
| **v2** | Painel Master completo (observabilidade), rotação de chaves automatizada, HA multi-região, LTV/CAC avançados, otimizações de performance e custos | **≈ 20%** |

### ✅ Decisão da seção 10
**Todos os serviços stateless com HPA no Kubernetes, Postgres particionado com read replicas e Redis Cluster; entrega em 3 fases começando por um vertical slice funcional (MVP com 4 integrações).** Justificativa: o MVP prova o pipeline ponta a ponta (integração → sync → financeiro → dashboard) com custo controlado antes de escalar horizontalmente as integrações na v1; a arquitetura stateless desde o MVP evita reescrita ao chegar à v2 multi-região.

---

*Blueprint pronto para o time de engenharia iniciar a implementação — 10 seções, cada uma com decisão concreta e justificada.*
