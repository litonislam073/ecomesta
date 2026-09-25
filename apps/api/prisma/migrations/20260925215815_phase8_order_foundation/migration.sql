-- AlterTable
ALTER TABLE "order_addresses" ADD COLUMN     "email" CITEXT;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "order_sequence" INTEGER NOT NULL DEFAULT 100000;
