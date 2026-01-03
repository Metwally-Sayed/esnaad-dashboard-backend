# Multi-stage build for optimized production image
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && \
    npm install -g typescript && \
    npm install --save-dev @types/node

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine

# Install OpenSSL for Prisma (required at runtime)
RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy node_modules with generated Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port (8080 for claw.cloud)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) process.exit(1)})" || exit 1

# Run database migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]