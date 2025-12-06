# Frontend Dockerfile - Multi-stage build for React app with Vite
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with cache mount for faster builds
# The --force flag ensures optional dependencies are installed
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps

# Development stage - for live reloading
FROM base AS dev
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose port for development server
EXPOSE 3000

# Start development server
CMD ["npm", "start"]

# Builder stage - build React app with Vite
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the React application with Vite
ENV NODE_ENV=production
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine AS runner

# Copy custom nginx config for client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app to nginx html directory
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
