# Multi-stage build for efficiency

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install to generate lock file if missing)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# No EXPOSE needed - this is a background service (no HTTP server)

# Set environment variables
ENV NODE_ENV=production

# Start the application (background process)
CMD ["node", "dist/main"]

