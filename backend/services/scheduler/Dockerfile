# Multi-stage build for npm workspaces monorepo

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/scheduler/package*.json ./services/scheduler/

# Install all dependencies (workspaces will link automatically)
RUN npm install

# Copy shared lib source
COPY lib/ ./lib/

# Build shared lib first
RUN npm run build -w lib

# Copy scheduler service source
COPY services/scheduler/ ./services/scheduler/

# Build scheduler service
RUN npm run build -w services/scheduler

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/scheduler/package*.json ./services/scheduler/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built shared lib from builder
COPY --from=builder /app/lib/dist ./lib/dist

# Copy built scheduler service from builder
COPY --from=builder /app/services/scheduler/dist ./services/scheduler/dist

# Set environment variables
ENV NODE_ENV=production

# Start the application from the service directory
WORKDIR /app/services/scheduler
CMD ["node", "dist/main"]
