FROM node:20-alpine
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
