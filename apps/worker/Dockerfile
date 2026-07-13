FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @rate-snoop/worker... build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app/apps/worker

ENV NODE_ENV=production

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/package.json ./package.json
COPY --from=builder /app/apps/worker/node_modules ./node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages /app/packages

EXPOSE 3002
CMD ["node", "dist/apps/worker/src/main"]
