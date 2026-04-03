# Multi-stage Dockerfile for Stockfish Server
# Using Alpine Linux

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install Stockfish using Alpine's package manager
RUN apk add --no-cache stockfish

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --only=production

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]