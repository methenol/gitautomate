
# 1. Builder/Dependencies Stage
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# 2. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Production/Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary files from the builder stage
COPY --from=builder /app/package.json .
COPY --from=builder /app/next.config.ts .
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
# Conditionally copy the public directory if it exists to prevent build errors
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/ai ./src/ai

# Expose ports for Next.js app and Genkit UI
EXPOSE 9002
EXPOSE 4000

CMD ["npm", "run", "prod:start"]
