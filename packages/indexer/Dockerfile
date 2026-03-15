FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/indexer/package.json ./packages/indexer/
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

# Build the indexer
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=shared-builder /app/packages/shared ./packages/shared
COPY packages/indexer ./packages/indexer
COPY tsconfig.json ./
RUN pnpm --filter @stellar-analytics/indexer build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 indexer

# Copy built application
COPY --from=builder --chown=indexer:nodejs /app/packages/indexer/dist ./dist
COPY --from=builder --chown=indexer:nodejs /app/packages/indexer/package.json ./package.json
COPY --from=builder --chown=indexer:nodejs /app/packages/indexer/node_modules ./node_modules

# Create logs directory
RUN mkdir -p /app/logs && chown indexer:nodejs /app/logs

USER indexer

EXPOSE 3001

ENV PORT 3001

CMD ["node", "dist/index.js"]
