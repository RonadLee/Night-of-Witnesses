FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/game-server/package.json apps/game-server/
COPY packages/game-engine/package.json packages/game-engine/
COPY packages/game-types/package.json packages/game-types/
RUN pnpm install --frozen-lockfile --filter @now/game-server...

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/game-server/node_modules ./apps/game-server/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/game-server ./apps/game-server
COPY packages/game-engine ./packages/game-engine
COPY packages/game-types ./packages/game-types
WORKDIR /app/apps/game-server
ENV PORT=2567
EXPOSE 2567
CMD ["pnpm", "start"]
