FROM node:24-bookworm-slim

WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @fitness/worker build

CMD ["pnpm", "--filter", "@fitness/worker", "dev"]
