# =============================================================
# Administrasi Perkebunan — Backend API (Node.js + Express + TS)
# Base directory di Coolify: /backend  |  Build pack: Dockerfile
# =============================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile --production=false

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STORAGE_DIR=/data/uploads
WORKDIR /app
RUN apk add --no-cache curl && mkdir -p /data/uploads
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
COPY server ./server
COPY database ./database
COPY scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/_healthcheck || exit 1
CMD ["node", "node_modules/.bin/tsx", "server/index.ts"]
