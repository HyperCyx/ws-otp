# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production Image ─────────────────────────────────────────────────
FROM node:20-alpine

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs . .

# Create logs directory (writable by nodeuser)
RUN mkdir -p logs && chown nodeuser:nodejs logs

USER nodeuser

EXPOSE 3000

# Use dumb-init to properly handle PID 1 and forward signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
