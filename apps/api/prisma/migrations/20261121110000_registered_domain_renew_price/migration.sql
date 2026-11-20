-- Renewal price per year (USD) of a registered domain, kept for renewal quotes.
ALTER TABLE "registered_domains" ADD COLUMN "renew_usd" DECIMAL(10,2);
