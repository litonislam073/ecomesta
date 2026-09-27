# Docker

| File | Purpose |
| --- | --- |
| `docker-compose.yml` (repo root) | Local development: Postgres + Redis only, published on localhost for `pnpm dev`. |
| `docker-compose.prod.yml` (repo root) | VPS staging/production: postgres, redis, api, web, merchant, admin, nginx. |
| `apps/*/Dockerfile` | Multi-stage production images (build context = repo root). |
| `.dockerignore` (repo root) | Keeps `.env*`, `node_modules`, build output and keys out of the build context. |

Deployment procedure: [`docs/deployment.md`](../../docs/deployment.md).
