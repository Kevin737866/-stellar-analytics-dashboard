FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Rebuild the shared package
FROM base AS shared-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./
RUN pnpm --filter @stellar-analytics/shared build

# Build the API
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY tsconfig.json ./
RUN pnpm --filter @stellar-analytics/api build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy built application
COPY --from=builder --chown=api:nodejs /app/packages/api/dist ./dist
COPY --from=builder --chown=api:nodejs /app/packages/api/package.json ./package.json
COPY --from=builder --chown=api:nodejs /app/packages/api/node_modules ./node_modules

# Create logs directory
RUN mkdir -p /app/logs && chown api:nodejs /app/logs

USER api

EXPOSE 4000

ENV PORT 4000

CMD ["node", "dist/index.js"]
