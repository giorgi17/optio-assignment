# Multi-stage build for npm workspaces monorepo

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/worker/package*.json ./services/worker/

# Install all dependencies (workspaces will link automatically)
RUN npm install

# Copy shared lib source
COPY lib/ ./lib/

# Build shared lib first
RUN npm run build -w lib

# Copy worker service source
COPY services/worker/ ./services/worker/

# Build worker service
RUN npm run build -w services/worker

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/worker/package*.json ./services/worker/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built shared lib from builder
COPY --from=builder /app/lib/dist ./lib/dist

# Copy built worker service from builder
COPY --from=builder /app/services/worker/dist ./services/worker/dist

# Set environment variables
ENV NODE_ENV=production

# Start the application from the service directory
WORKDIR /app/services/worker
CMD ["node", "dist/main"]
