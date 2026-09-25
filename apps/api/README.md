# Ecomesta API – NestJS

Runtime notes for the backend application.

## Local development

```bash
# from repo root
cp .env.example .env
pnpm docker:up
pnpm install
pnpm db:generate
pnpm --filter @ecomesta/api prisma migrate dev --name init
pnpm dev:api
```

Health check: `GET http://localhost:3001/api/v1/health`
