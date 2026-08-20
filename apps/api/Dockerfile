FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @itay-chai/database generate
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "tsx", "src/main.ts"]
