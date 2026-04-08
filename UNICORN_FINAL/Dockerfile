# Multi-stage Dockerfile for ZEUS AI Unicorn Platform
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ .
ENV CI=false
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/Europe/Bucharest /etc/localtime \
    && echo "Europe/Bucharest" > /etc/timezone

WORKDIR /app

# Copy backend dependencies and install
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy backend source
COPY backend/ ./backend/
COPY src/ ./src/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/client/build ./client/build

# Copy configuration files
COPY ecosystem.config.js ./
COPY vercel.json ./

# Create required directories
RUN mkdir -p logs backups/config

# Non-root user for security
RUN addgroup -g 1001 -S unicorn && \
    adduser -S unicorn -u 1001 -G unicorn && \
    chown -R unicorn:unicorn /app

USER unicorn

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "backend/index.js"]
