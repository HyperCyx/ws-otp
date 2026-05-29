# ─────────────────────────────────────────────
# Stage 1: Build the Vite + React app
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

RUN npm ci

# Copy the rest of the source
COPY . .

# Build the production bundle (outputs to /app/dist)
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Serve with nginx on port 5000
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the built static files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 5000
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
