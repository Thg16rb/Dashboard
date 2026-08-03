# Dashboard (codinome: TrafficIntel)

> SaaS B2B multi-tenant de inteligência para tráfego pago e gestão financeira.
> **Nome provisório** — será renomeado depois.

O blueprint técnico completo (10 seções, decisões fechadas) está em [`BLUEPRINT.md`](./BLUEPRINT.md).

## Stack fixa
Next.js + React + TypeScript · NestJS + Fastify · PostgreSQL · Redis · BullMQ · WebSockets · Prisma · Docker · Kubernetes-ready.

## Roadmap de execução (agente remoto)

O projeto é construído passo a passo, cada passo abrindo um PR para revisão:

- [x] **Passo 1 — Scaffolding do monorepo:** estrutura `apps/api` (NestJS+Fastify) + `apps/web` (Next.js), `docker-compose` (Postgres+Redis), `schema.prisma` inicial (tenants, users, memberships, integrations, integration_credentials, sync_runs), config de RLS, CI básico (lint+build). ✅
- [x] **Passo 2 — Auth:** JWT + Refresh rotativo + 2FA TOTP, sessões/dispositivos, login_history. ✅
- [ ] **Passo 3 — Multi-tenancy:** interceptor `SET app.tenant_id` + políticas RLS + RBAC (7 papéis, guards).
- [ ] **Passo 4 — Primeira integração (Adapter+Registry):** contrato `IntegrationConnector` + connector Meta Ads + Stripe.
- [ ] **Passo 5 — Pipeline de sync:** BullMQ scheduler (15 min) + fanout + "Atualizar Agora" + upsert idempotente.
- [ ] **Passo 6 — Dashboard core:** KPIs server-side, comparação por períodos, WebSocket realtime.
- [ ] **Passo 7 — Financeiro:** regras parametrizáveis + função de cálculo pura.

## Estrutura do projeto

```
Dashboard/
├── apps/
│   ├── api/                 # NestJS + Fastify (Clean Architecture / DDD)
│   │   ├── src/
│   │   │   ├── infra/       # prisma, health
│   │   │   └── modules/     # auth, tenants, users, integrations, sync, finance, webhooks
│   │   │                    #   cada um com camadas domain/application/infra
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/  # 0001_init (tabelas) + 0002_rls (Row-Level Security)
│   └── web/                 # Next.js App Router
├── docker-compose.yml       # postgres:16 + redis:7
├── .env.example
└── .github/workflows/ci.yml # install + lint + build
```

## Como subir localmente

Pré-requisitos: Node 20+, pnpm 9+, Docker.

```bash
# 1. subir Postgres + Redis
docker compose up -d

# 2. variáveis de ambiente
cp .env.example .env

# 3. dependências
pnpm install

# 4. aplicar migrations (tabelas + RLS)
pnpm --filter @dashboard/api exec prisma migrate deploy

# 5. rodar API (:3333) e web (:3000)
pnpm dev
```

Health check da API: `GET http://localhost:3333/health`.

## Status
Fase: **MVP** (~45% do escopo total). Início: 2026-08-03. **Passos 1 e 2 concluídos.**
Próximo: **Passo 3 — Multi-tenancy (interceptor SET app.tenant_id + RLS + RBAC).**

### Endpoints de auth (Passo 2)
`POST /auth/login` · `POST /auth/2fa` · `POST /auth/refresh` · `POST /auth/logout` ·
`GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/sessions/revoke-others`
