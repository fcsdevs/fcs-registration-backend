# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev deps to generate prisma)
RUN npm install

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Final stage
FROM node:20-slim

WORKDIR /app

# Install system dependencies (openssl for Prisma, dumb-init for signals)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    dumb-init \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PM2 globally
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production && npm cache clean --force

# Copy prisma schema and generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy application code and PM2 config
COPY src ./src
COPY scripts ./scripts
COPY ecosystem.config.cjs ./

# Expose port
EXPOSE 5005

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application: Run recovery check then start with node directly
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
