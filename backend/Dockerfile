# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Stellar CLI (needed by settlement-keeper to sign transactions)
RUN apk add --no-cache curl tar libgcc && \
    curl -fsSL "https://github.com/stellar/stellar-cli/releases/download/v26.0.0/stellar-cli-26.0.0-x86_64-unknown-linux-gnu.tar.gz" \
      | tar -xz -C /usr/local/bin stellar

# Non-root user for security
RUN addgroup -S strix && adduser -S strix -G strix

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# SQLite data directory
RUN mkdir -p /data && chown strix:strix /data
ENV DB_PATH=/data/strix.db

USER strix

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
