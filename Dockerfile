# Stage 1: All deps for build
FROM node:22-alpine AS deps
RUN --mount=type=cache,target=/etc/apk/cache \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --legacy-peer-deps

# Stage 2: Build
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="file:./dev.db"
COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN DISABLE_BACKGROUND_JOBS=true npm run build
RUN npm rebuild better-sqlite3

# Stage 3: Production deps only
FROM node:22-alpine AS production-deps
RUN --mount=type=cache,target=/etc/apk/cache \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --legacy-peer-deps --omit=dev
RUN npx prisma generate --schema=./prisma/schema.prisma --generator=client
RUN npm rebuild better-sqlite3

# Stage 4: Runner with minimal deps
FROM production-deps AS runner
RUN apk add --no-cache libc6-compat curl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/dev.db"
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data && chown -R nextjs:nodejs /app/data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/
# Normalize Windows archives and avoid downloading tsx during production startup.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's|npx tsx /app/scripts/ensure-admin.ts|node --experimental-strip-types /app/scripts/ensure-admin.ts|' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown nextjs:nodejs /usr/local/bin/docker-entrypoint.sh
USER nextjs
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
