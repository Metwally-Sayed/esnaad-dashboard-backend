# Multi-stage build for optimized production image
# Stage 1: Build stage
FROM node:22-alpine AS builder

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
FROM node:22-alpine

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

# Copy tsconfig files for path resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig-paths-bootstrap.js ./tsconfig-paths-bootstrap.js

# Copy node_modules with generated Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/tsconfig-paths ./node_modules/tsconfig-paths

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port (8080 for claw.cloud)
EXPOSE 8080

# Health check (uses PORT env variable)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get(`http://localhost:${port}/health`, (r) => {if (r.statusCode !== 200) process.exit(1)})" || exit 1

# Start the application without automatic migrations
# To run migrations manually: npx prisma migrate deploy
CMD ["npm", "start"]