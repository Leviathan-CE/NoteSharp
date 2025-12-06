# Backend Dockerfile - Multi-stage build for TypeScript Express API
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Builder stage - compile TypeScript
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Production stage - minimal runtime image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create uploads directory and set permissions before switching to non-root user
RUN mkdir -p /app/uploads && \
    chown -R expressjs:nodejs /app/uploads

# Set user
USER expressjs

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
