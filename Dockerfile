FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY UNICORN_FINAL/package*.json ./

# Install production dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy application code
COPY UNICORN_FINAL/ .

# Build client if it exists and has build script
RUN if [ -d "client" ] && [ -f "client/package.json" ]; then \
      cd client && npm ci --no-audit --no-fund && CI=false npm run build && cd ..; \
    fi

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
