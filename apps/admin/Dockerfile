# syntax=docker/dockerfile:1.7
# Build from the repository root:
#   docker build -f apps/admin/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... -t ecomesta-admin:<tag> .
# NEXT_PUBLIC_* values are inlined at build time (public URLs only).

ARG NODE_IMAGE=node:20-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/merchant/package.json apps/merchant/
COPY apps/admin/package.json apps/admin/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter "@ecomesta/admin..."

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production \
  NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" >&2; exit 1)
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN pnpm --filter "@ecomesta/admin^..." run build \
  && pnpm --filter @ecomesta/admin run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3003
WORKDIR /app
COPY --from=build --chown=1000:1000 /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=1000:1000 /repo/apps/admin/public ./apps/admin/public
USER 1000:1000
EXPOSE 3003
CMD ["node", "apps/admin/server.js"]
