#!/usr/bin/env bash
# Sistema completo no servidor: Postgres + API NestJS (com migrations) + Web,
# tudo atrás do Traefik do Coolify, com HTTPS automático.
#   web → https://dashboard.sistemautomacao.com
#   api → https://api.dashboard.sistemautomacao.com
set -e

WEB_DOMAIN="dashboard.sistemautomacao.com"
API_DOMAIN="api.dashboard.sistemautomacao.com"
DB_PASS="dashboard_$(head -c 8 /dev/urandom | base64 | tr -dc a-z0-9 | head -c 10)"

echo "==> [1/6] Atualizando código"
cd ~/Dashboard
git fetch origin
git checkout demo/dashboard-preview
git reset --hard origin/demo/dashboard-preview

NET=coolify

echo "==> [2/6] Subindo PostgreSQL (persistente)"
docker rm -f dashboard-db 2>/dev/null || true
docker volume create dashboard-pgdata >/dev/null 2>&1 || true
docker run -d --name dashboard-db --restart unless-stopped \
  --network "$NET" \
  -e POSTGRES_USER=dashboard \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB=dashboard \
  -v dashboard-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
echo "    aguardando o banco aceitar conexões..."
sleep 8

DATABASE_URL="postgresql://dashboard:${DB_PASS}@dashboard-db:5432/dashboard?schema=public"

echo "==> [3/6] Buildando a API (NestJS)"
docker build -f ~/Dashboard/apps/api/Dockerfile -t dashboard-api ~/Dashboard

echo "==> [4/6] Subindo a API (aplica migrations no boot)"
docker rm -f dashboard-api 2>/dev/null || true
docker run -d --name dashboard-api --restart unless-stopped \
  --network "$NET" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e REDIS_URL="redis://coolify-redis:6379" \
  -e JWT_ACCESS_SECRET="$(head -c 24 /dev/urandom | base64)" \
  -e JWT_REFRESH_SECRET="$(head -c 24 /dev/urandom | base64)" \
  -e ENCRYPTION_KEY="$(head -c 24 /dev/urandom | base64)" \
  -e API_PORT=3333 \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.api.rule=Host(\`$API_DOMAIN\`)" \
  --label "traefik.http.routers.api.entrypoints=https" \
  --label "traefik.http.routers.api.tls=true" \
  --label "traefik.http.routers.api.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.api.loadbalancer.server.port=3333" \
  dashboard-api

echo "==> [5/6] Rebuild do Web apontando para a API real"
cat > ~/Dashboard/Dockerfile.web <<DOCKER
FROM node:20-alpine
RUN npm i -g pnpm
WORKDIR /app
COPY . .
ENV NEXT_PUBLIC_API_URL=https://${API_DOMAIN}
RUN pnpm --filter @dashboard/web install
RUN pnpm --filter @dashboard/web build
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm","start"]
DOCKER
docker build -f ~/Dashboard/Dockerfile.web -t dashboard-front ~/Dashboard
docker rm -f dashboard-front 2>/dev/null || true
docker run -d --name dashboard-front --restart unless-stopped \
  --network "$NET" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.dash.rule=Host(\`$WEB_DOMAIN\`)" \
  --label "traefik.http.routers.dash.entrypoints=https" \
  --label "traefik.http.routers.dash.tls=true" \
  --label "traefik.http.routers.dash.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.dash.loadbalancer.server.port=3000" \
  dashboard-front

echo "==> [6/6] Status"
docker ps --filter name=dashboard --format "{{.Names}}: {{.Status}}"
echo ""
echo "PRONTO. Aguarde ~1 min o Traefik emitir os certificados."
echo "   Web: https://${WEB_DOMAIN}"
echo "   API: https://${API_DOMAIN}/health"
echo ""
echo "IMPORTANTE: crie o registro DNS A para 'api.dashboard' -> 185.225.22.172"
echo "senão o certificado da API não é emitido."
