# Multi-stage Dockerfile for Stockfish Server
# Stage 1: Build the TypeScript app
FROM node:20 AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

# Stage 2: Production runtime
FROM ubuntu:22.04

WORKDIR /app

# Install Node.js 20 and download Stockfish
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && wget -q https://github.com/official-stockfish/Stockfish/releases/download/sf_16.1/stockfish-ubuntu-x86-64.tar \
    -O /tmp/sf.tar \
    && mkdir -p /usr/local/bin/stockfish \
    && tar -xf /tmp/sf.tar -C /usr/local/bin/stockfish \
    && chmod +x /usr/local/bin/stockfish/stockfish-ubuntu-x86-64 \
    && ln -sf /usr/local/bin/stockfish/stockfish-ubuntu-x86-64 /usr/local/bin/stockfish \
    && rm /tmp/sf.tar

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --only=production

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]