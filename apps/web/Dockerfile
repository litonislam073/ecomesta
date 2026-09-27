# syntax=docker/dockerfile:1.7
# Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... -t ecomesta-web:<tag> .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build args (public URLs only — never pass secrets here).

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
RUN pnpm install --frozen-lockfile --filter "@ecomesta/web..."

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_MERCHANT_URL
ARG NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN
ARG NEXT_PUBLIC_DEFAULT_STORE_SLUG=
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL=
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
ENV NODE_ENV=production \
  NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
  NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL} \
  NEXT_PUBLIC_MERCHANT_URL=${NEXT_PUBLIC_MERCHANT_URL} \
  NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN=${NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN} \
  NEXT_PUBLIC_DEFAULT_STORE_SLUG=${NEXT_PUBLIC_DEFAULT_STORE_SLUG} \
  NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
  NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=${NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" >&2; exit 1)
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter "@ecomesta/web^..." run build \
  && pnpm --filter @ecomesta/web run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=1000:1000 /repo/apps/web/public ./apps/web/public
USER 1000:1000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
