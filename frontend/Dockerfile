# =============================================================================
# MAIDAN Frontend — Next.js Dockerfile
# =============================================================================

# --- Base ---
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm


# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm config set registry https://registry.npmjs.org/
RUN pnpm install --no-frozen-lockfile

# --- Development ---
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# --- Builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL

RUN pnpm build

# --- Production ---
FROM base AS production
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
