/**
 * Shared platform-wide types aligned with Phase 2 Prisma enums.
 * Domain DTOs for ecommerce modules arrive with later API phases.
 */

export type PlatformRole = 'USER' | 'SUPER_ADMIN';
export type TenantRole = 'OWNER' | 'ADMIN' | 'STAFF';
export type StoreRole = 'STORE_MANAGER' | 'STORE_STAFF';

export type ApiEnvironment = 'development' | 'test' | 'production';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface JwtPayloadBase {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  tenantId?: string;
  tenantRole?: TenantRole;
  storeIds?: string[];
}

export type CustomerAddressType = 'BILLING' | 'SHIPPING';

export interface Customer {
  id: string;
  storeId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: CustomerAddressType;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  addresses: CustomerAddress[];
}

export interface StoreSummary {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  currency: string;
  timezone: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface OffsetPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

export interface ProductCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: ProductStatus;
  productType: ProductType;
  sku: string | null;
  barcode: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  trackInventory: boolean;
  allowBackorder: boolean;
  onHandQuantity?: number;
  categoryIds: string[];
  categories: ProductCategoryRef[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  weight: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  variants: ProductVariant[];
}

export interface Category {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

export interface InventoryItem {
  id: string;
  storeId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number | null;
  availableQuantity: number;
  product?: { id: string; name: string; sku: string | null };
  variant?: { id: string; name: string; sku: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  storeId: string;
  productId: string;
  variantId: string | null;
  type: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export type FulfillmentStatus =
  | 'UNFULFILLED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'RETURNED'
  | 'CANCELLED';

export interface OrderCustomerRef {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface OrderListItem {
  id: string;
  storeId: string;
  customerId: string | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  itemCount: number;
  customer: OrderCustomerRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemSnapshot {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  createdAt: string;
}

export interface OrderAddressSnapshot {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
}

export interface OrderPaymentRef {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  method: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderShipmentRef {
  id: string;
  provider: string;
  trackingNumber: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends OrderListItem {
  customerNote: string | null;
  internalNote: string | null;
  items: OrderItemSnapshot[];
  addresses: OrderAddressSnapshot[];
  payments: OrderPaymentRef[];
  shipments: OrderShipmentRef[];
}

/** Public storefront (Phase 9) — customer-safe shapes only. */

export interface PublicStore {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  currency: string;
  timezone: string;
  locale: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  children?: PublicCategory[];
}

export interface PublicProductImage {
  url: string;
  alt: string;
}

export interface PublicProductCard {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  productType: string;
  currency: string;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  available: boolean;
  images: PublicProductImage[];
  categories: { id: string; name: string; slug: string }[];
  hasVariants: boolean;
}

export interface PublicProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  available: boolean;
}

export interface PublicProductDetail extends PublicProductCard {
  description: string | null;
  variants: PublicProductVariant[];
}

/** Public checkout (Phase 10) — guest order placement. */

export type PublicCheckoutPaymentProvider = 'COD' | 'OTHER';
export type PublicCheckoutPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'OTHER';

export interface PublicCheckoutItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface PublicCheckoutAddressInput {
  name: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface PublicCheckoutRequest {
  items: PublicCheckoutItemInput[];
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  shippingAddress: PublicCheckoutAddressInput;
  billingAddress?: PublicCheckoutAddressInput;
  billingSameAsShipping?: boolean;
  paymentProvider: PublicCheckoutPaymentProvider;
  paymentMethod: PublicCheckoutPaymentMethod;
  customerNote?: string;
}

export interface PublicCheckoutConfirmation {
  orderNumber: string;
  publicReference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  paymentMethod: string | null;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
}

export interface PublicOrderItemSummary {
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface PublicOrderAddressSummary {
  name: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface PublicOrderConfirmationDetail extends PublicCheckoutConfirmation {
  customerNote: string | null;
  createdAt: string;
  items: PublicOrderItemSummary[];
  shippingAddress: PublicOrderAddressSummary | null;
  billingAddress: PublicOrderAddressSummary | null;
}
