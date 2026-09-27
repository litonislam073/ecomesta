-- Store slugs become the platform subdomain label, so they must be unique
-- across tenants. Fails (without changing data) if duplicates already exist.
DROP INDEX "stores_tenant_id_slug_key";

CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
