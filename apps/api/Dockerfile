# node:20-slim (Debian) — tem OpenSSL, necessário para o engine do Prisma.
FROM node:20-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm
WORKDIR /app

# Copia o monorepo (contexto é a raiz)
COPY . .

RUN pnpm --filter @dashboard/api install
RUN pnpm --filter @dashboard/api exec prisma generate
RUN pnpm --filter @dashboard/api build

WORKDIR /app/apps/api
EXPOSE 3333

# Aplica migrations e sobe a API
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
