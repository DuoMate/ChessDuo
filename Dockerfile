# Multi-stage Dockerfile for Stockfish Server
# Stage 1: Build the TypeScript app
FROM node:20 AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

# Stage 2: Production runtime with Stockfish
FROM ubuntu:22.04

WORKDIR /app

# Install Stockfish and Node.js
RUN apt-get update && apt-get install -y \
    stockfish \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --only=production

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]