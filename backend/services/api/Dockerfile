# Multi-stage build for npm workspaces monorepo

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/api/package*.json ./services/api/

# Install all dependencies (workspaces will link automatically)
RUN npm install

# Copy shared lib source
COPY lib/ ./lib/

# Build shared lib first
RUN npm run build -w lib

# Copy API service source
COPY services/api/ ./services/api/

# Build API service
RUN npm run build -w services/api

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy workspace package files
COPY lib/package*.json ./lib/
COPY services/api/package*.json ./services/api/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built shared lib from builder
COPY --from=builder /app/lib/dist ./lib/dist

# Copy built API service from builder
COPY --from=builder /app/services/api/dist ./services/api/dist

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application from the service directory
WORKDIR /app/services/api
CMD ["node", "dist/main"]
