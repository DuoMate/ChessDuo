# Frontend Dockerfile - Simple Next.js Build
FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build with env vars
ENV NEXT_PUBLIC_SUPABASE_URL=https://kyojsrllyczlpjvqnlpa.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5b2pzcmxseWN6bHBqdnFubHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc1ODIsImV4cCI6MjA5MDE5MzU4Mn0.RT7lA7WBRsUcObKCECA-JwTuxtJUAFxnjNdLsfmsAzQ
ENV NEXT_PUBLIC_STOCKFISH_SERVER_URL=https://chessduo-bllo.onrender.com

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["npm", "start"]