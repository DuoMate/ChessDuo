# Multi-stage Dockerfile for Next.js Frontend
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (required for prerendering)
# These MUST be present at build time - runtime gets values from Render Environment
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://kyojsrllyczlpjvqnlpa.supabase.co}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5b2pzcmxseWN6bHBqdnFubHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc1ODIsImV4cCI6MjA5MDE5MzU4Mn0.RT7lA7WBRsUcObKCECA-JwTuxtJUAFxnjNdLsfmsAzQ}
ENV NEXT_PUBLIC_STOCKFISH_SERVER_URL=${NEXT_PUBLIC_STOCKFISH_SERVER_URL:-https://chessduo-bllo.onrender.com}

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

ENV PORT 3000
ENV HOSTNAME 0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]