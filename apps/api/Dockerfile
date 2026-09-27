# syntax=docker/dockerfile:1.7
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t ecomesta-api:<tag> .
# Targets:
#   runtime (default) — compiled NestJS + production deps + Prisma CLI for `migrate deploy`
#   tools             — full toolchain, used only for one-off seeding

ARG NODE_IMAGE=node:20-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV CI=true
# Debian drops superseded package versions, so exact apt pins break rebuilds; NODE_IMAGE pins the release.
# hadolint ignore=DL3008
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/merchant/package.json apps/merchant/
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/ui/package.json packages/ui/

FROM manifests AS deps
RUN pnpm install --frozen-lockfile --filter "@ecomesta/api..."

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter "@ecomesta/api^..." run build \
  && pnpm --filter @ecomesta/api exec prisma generate \
  && pnpm --filter @ecomesta/api run build \
  && find apps/api/dist packages/types/dist packages/utils/dist -name '*.map' -delete

FROM build AS tools
WORKDIR /repo/apps/api
USER 1000:1000
CMD ["./node_modules/.bin/ts-node", "--transpile-only", "prisma/seed.ts"]

FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@ecomesta/api..."
COPY apps/api/prisma ./apps/api/prisma
WORKDIR /repo/apps/api
RUN ./node_modules/.bin/prisma generate

FROM ${NODE_IMAGE} AS runtime
# hadolint ignore=DL3008
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages/types/package.json ./packages/types/package.json
COPY --from=build /repo/packages/types/dist ./packages/types/dist
COPY --from=build /repo/packages/utils/package.json ./packages/utils/package.json
COPY --from=build /repo/packages/utils/dist ./packages/utils/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=build /repo/apps/api/prisma/migrations ./apps/api/prisma/migrations
WORKDIR /app/apps/api
USER 1000:1000
EXPOSE 3001
CMD ["node", "dist/main.js"]
