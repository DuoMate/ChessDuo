# Multi-stage Dockerfile for Stockfish Server
# Stage 1: Build Node.js app
FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

# Stage 2: Production - download Stockfish binary
FROM alpine:3.19 AS production

WORKDIR /app

# Download and extract Stockfish to /usr/local/bin
RUN wget -q https://github.com/official-stockfish/Stockfish/releases/download/sf_16.1/stockfish-ubuntu-x86-64.tar \
    -O /tmp/stockfish.tar \
    && mkdir -p /usr/local/bin/stockfish \
    && tar -xf /tmp/stockfish.tar -C /usr/local/bin/stockfish --strip-components=1 \
    && rm /tmp/stockfish.tar \
    && chmod +x /usr/local/bin/stockfish/stockfish \
    && ln -s /usr/local/bin/stockfish/stockfish /usr/local/bin/stockfish

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install Node.js runtime
RUN apk add --no-cache nodejs npm \
    && npm ci --only=production \
    && rm -rf /var/cache/apk/*

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]