-- Couriers a merchant can record on a shipment (tracking number added by hand).
ALTER TYPE "ShippingProvider" ADD VALUE IF NOT EXISTS 'PAPERFLY';
ALTER TYPE "ShippingProvider" ADD VALUE IF NOT EXISTS 'ECOURIER';
ALTER TYPE "ShippingProvider" ADD VALUE IF NOT EXISTS 'DELIVERY_TIGER';
ALTER TYPE "ShippingProvider" ADD VALUE IF NOT EXISTS 'CARRYBEE';
ALTER TYPE "ShippingProvider" ADD VALUE IF NOT EXISTS 'KARATOA';
