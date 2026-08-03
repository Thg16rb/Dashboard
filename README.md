# Dashboard (codinome: TrafficIntel)

> SaaS B2B multi-tenant de inteligência para tráfego pago e gestão financeira.
> **Nome provisório** — será renomeado depois.

O blueprint técnico completo (10 seções, decisões fechadas) está em [`BLUEPRINT.md`](./BLUEPRINT.md).

## Stack fixa
Next.js + React + TypeScript · NestJS + Fastify · PostgreSQL · Redis · BullMQ · WebSockets · Prisma · Docker · Kubernetes-ready.

## Roadmap de execução (agente remoto)

O projeto é construído passo a passo, cada passo abrindo um PR para revisão:

- [ ] **Passo 1 — Scaffolding do monorepo:** estrutura `apps/api` (NestJS+Fastify) + `apps/web` (Next.js), `docker-compose` (Postgres+Redis), `schema.prisma` inicial (tenants, users, memberships, integrations, integration_credentials, sync_runs), config de RLS, CI básico (lint+build).
- [ ] **Passo 2 — Auth:** JWT + Refresh rotativo + 2FA TOTP, sessões/dispositivos, login_history.
- [ ] **Passo 3 — Multi-tenancy:** interceptor `SET app.tenant_id` + políticas RLS + RBAC (7 papéis, guards).
- [ ] **Passo 4 — Primeira integração (Adapter+Registry):** contrato `IntegrationConnector` + connector Meta Ads + Stripe.
- [ ] **Passo 5 — Pipeline de sync:** BullMQ scheduler (15 min) + fanout + "Atualizar Agora" + upsert idempotente.
- [ ] **Passo 6 — Dashboard core:** KPIs server-side, comparação por períodos, WebSocket realtime.
- [ ] **Passo 7 — Financeiro:** regras parametrizáveis + função de cálculo pura.

## Status
Fase: **MVP** (~45% do escopo total). Início: 2026-08-03.
