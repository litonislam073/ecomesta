-- SF-04: store uploaded product image bytes in the existing media table.
ALTER TABLE "media" ADD COLUMN "data" BYTEA;
