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
  imageUrl?: string | null;
  /** Sample content from the optional demo catalog import. */
  isDemo?: boolean;
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
  /** Sample content from the optional demo catalog import. */
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

export interface DemoCatalogStatus {
  available: boolean;
  imported: boolean;
  hasRealProducts: boolean;
}

export interface DemoCatalogImportResult {
  categories: number;
  products: number;
  variants: number;
  inventoryItems: number;
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

export type ShippingMethodType = 'FLAT' | 'WEIGHT_BASED' | 'FREE' | 'EXTERNAL';
export type ShippingProvider = 'MANUAL' | 'PATHAO' | 'STEADFAST' | 'REDX' | 'OTHER';
export type ShipmentStatus =
  | 'PENDING'
  | 'LABEL_CREATED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
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
  shippingMethodName?: string | null;
  shippingMethodType?: ShippingMethodType | null;
  shippingZoneName?: string | null;
  couponCode?: string | null;
  itemCount: number;
  customer: OrderCustomerRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethod {
  id: string;
  storeId: string;
  name: string;
  type: ShippingMethodType;
  provider: ShippingProvider;
  price: string;
  active: boolean;
  configuration: Record<string, unknown> | null;
  zoneId: string | null;
  freeShippingThreshold: string | null;
  codAllowed: boolean;
  estimatedDelivery: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingZoneLocationRef {
  id: string;
  name: string;
  code: string;
}

export interface ShippingZoneLocation {
  id: string;
  divisionId: string | null;
  districtId: string | null;
  upazilaId: string | null;
  division: ShippingZoneLocationRef | null;
  district: ShippingZoneLocationRef | null;
  upazila: ShippingZoneLocationRef | null;
}

export interface ShippingZone {
  id: string;
  storeId: string;
  name: string;
  active: boolean;
  priority: number;
  methodCount?: number;
  locations: ShippingZoneLocation[];
  createdAt: string;
  updatedAt: string;
}

export interface BdLocationItem {
  id: string;
  code: string;
  name: string;
  divisionId?: string;
  districtId?: string;
}

export interface PublicShippingMethod {
  id: string;
  name: string;
  type: ShippingMethodType;
  price: string;
  description: string | null;
  zoneId?: string | null;
  freeShippingThreshold?: string | null;
  codAllowed?: boolean;
  estimatedDelivery?: string | null;
  sortOrder?: number;
  /** Quote-computed amount (may be 0 when free threshold met). */
  amount?: string;
  freeShippingApplied?: boolean;
}

export interface ShippingQuoteResponse {
  zone: { id: string; name: string; priority: number } | null;
  subtotal: string;
  discountTotal: string;
  subtotalAfterDiscount: string;
  couponCode: string | null;
  methods: PublicShippingMethod[];
}

export interface PublicCheckoutQuoteLine {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  /** Current catalog price (never the cart's stored snapshot). */
  unitPrice: string;
  lineTotal: string;
}

/** Server-priced checkout summary from POST /public/stores/:slug/checkout/quote. */
export interface PublicCheckoutQuote {
  currency: string;
  lines: PublicCheckoutQuoteLine[];
  subtotal: string;
  /** Applied coupon; null when none was sent or it no longer applies. */
  couponCode: string | null;
  /** Why the requested coupon does not apply, when it does not. */
  couponError: string | null;
  discountTotal: string;
  zone: { id: string; name: string; priority: number } | null;
  shippingMethods: PublicShippingMethod[];
  shippingMethodId: string | null;
  shippingTotal: string;
  taxTotal: string;
  /** Send back as `expectedTotal` when placing the order. */
  total: string;
}

export interface PaymentListItem {
  id: string;
  storeId: string;
  orderId: string;
  orderNumber: string;
  publicReference: string | null;
  internalReference: string;
  attemptNumber: number;
  provider: string;
  providerPaymentId: string | null;
  method: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetail extends PaymentListItem {
  metadata: unknown;
  order: {
    id: string;
    orderNumber: string;
    publicReference: string | null;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
  };
}

export interface PaymentProviderConfigSafe {
  id?: string;
  provider: string;
  enabled: boolean;
  mode: string;
  configured: boolean;
  hasSecrets: boolean;
  publicConfig: Record<string, unknown> | null;
  implemented: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PublicOnlinePaymentProvider {
  provider: string;
  mode: string;
  publicConfig: Record<string, unknown>;
}

export interface PublicPaymentProvidersResponse {
  offline: { provider: string; method: string }[];
  online: PublicOnlinePaymentProvider[];
}

export interface PublicPaymentInitiation {
  paymentId: string;
  internalReference: string;
  status: PaymentStatus;
  provider: string;
  amount: string;
  currency: string;
  attemptNumber: number;
  providerPaymentId: string | null;
  redirectUrl: string | null;
  clientPayload: Record<string, unknown> | null;
  storeSlug: string;
}

export interface PublicPaymentStatus {
  internalReference: string;
  status: PaymentStatus;
  provider: string;
  amount: string;
  currency: string;
  attemptNumber: number;
  orderNumber: string;
  publicReference: string | null;
  orderPaymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  providerPaymentId: string | null;
  updatedAt: string;
}

export interface ShipmentDetail {
  id: string;
  storeId: string;
  orderId: string;
  provider: ShippingProvider | string;
  trackingNumber: string | null;
  status: ShipmentStatus | string;
  shippedAt: string | null;
  deliveredAt: string | null;
  metadata?: unknown;
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
  providerPaymentId?: string | null;
  internalReference?: string;
  attemptNumber?: number;
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

export interface OrderTimelineEvent {
  type:
    | 'ORDER_CREATED'
    | 'ORDER_CONFIRMED'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_PAID'
    | 'PAYMENT_FAILED'
    | 'PROCESSING'
    | 'SHIPMENT_CREATED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED';
  label: string;
  description: string;
  occurredAt: string;
}

export interface PublicShipmentTracking {
  status: string;
  trackingNumber: string | null;
  provider: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderDetail extends OrderListItem {
  publicReference?: string | null;
  cancelReason?: string | null;
  customerNote: string | null;
  internalNote: string | null;
  items: OrderItemSnapshot[];
  addresses: OrderAddressSnapshot[];
  payments: OrderPaymentRef[];
  shipments: OrderShipmentRef[];
  timeline?: OrderTimelineEvent[];
}

/** Public storefront (Phase 9) — customer-safe shapes only. */

export type StoreLanguage = 'en' | 'bn';

export interface PublicStoreSeo {
  title: string | null;
  description: string | null;
  keywords: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  indexingEnabled: boolean;
}

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
  language?: StoreLanguage;
  contact?: {
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  checkout?: {
    requireEmail: boolean;
    requirePhone: boolean;
    allowOrderNotes: boolean;
  };
  allowCustomerCancellation?: boolean;
  seo?: PublicStoreSeo;
}

/* -------------------------------------------------------------------------- */
/* Merchant Settings                                                            */
/* -------------------------------------------------------------------------- */

export interface StoreSettings {
  storeId: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DRAFT';
  businessName: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  defaultLanguage: StoreLanguage;
  locale: string;
  checkoutRequirePhone: boolean;
  checkoutAllowOrderNotes: boolean;
  allowCustomerCancellation: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  seoIndexingEnabled: boolean;
  fixed: {
    guestCheckout: boolean;
    requireEmail: boolean;
    requireShippingAddress: boolean;
    currencyEditable: boolean;
    timezoneEditable: boolean;
    slugEditable: boolean;
    customerCancellableStatuses: string[];
  };
  permissions: { canEdit: boolean };
  createdAt: string;
  updatedAt: string;
}

export type UpdateStoreSettingsInput = Partial<
  Pick<
    StoreSettings,
    | 'name'
    | 'description'
    | 'email'
    | 'phone'
    | 'address'
    | 'defaultLanguage'
    | 'checkoutRequirePhone'
    | 'checkoutAllowOrderNotes'
    | 'allowCustomerCancellation'
    | 'seoTitle'
    | 'seoDescription'
    | 'seoKeywords'
    | 'ogTitle'
    | 'ogDescription'
    | 'ogImageUrl'
    | 'seoIndexingEnabled'
  >
> & { expectedUpdatedAt?: string };

export interface StoreSettingsSummary {
  payments: {
    offlineMethods: string[];
    onlineProviders: { provider: string; mode: 'test' | 'live' }[];
  };
  shipping: {
    methodCount: number;
    activeMethodCount: number;
    codMethodCount: number;
    zoneCount: number;
  };
  domains: {
    platformHostname: string | null;
    primaryHostname: string | null;
    customDomainCount: number;
    activeCustomDomainCount: number;
    pendingCustomDomainCount: number;
  };
  theme: {
    name: string | null;
    publishedAt: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
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

/** Where a gallery image is currently shown in the store. */
export interface MediaUsage {
  kind: 'product' | 'category' | 'store' | 'theme';
  id: string | null;
  label: string;
}

/** An image in the store's media gallery (merchant dashboard). */
export interface MediaItem {
  id: string;
  /** Public URL; usable anywhere the store accepts an image URL. */
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** Empty when the image is not used anywhere and can be deleted. */
  usedBy: MediaUsage[];
}

/** What an upload is for; each adds the checks that use relies on. */
export type MediaPurpose = 'general' | 'product' | 'logo' | 'favicon' | 'background';

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
  /**
   * Lowest / highest price among variants that can be bought now; null for
   * simple products or when no variant is available. For products with
   * variants, cards show these instead of `price` (often a placeholder).
   */
  variantPriceMin?: string | null;
  variantPriceMax?: string | null;
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

export type PublicCheckoutPaymentProvider =
  | 'COD'
  | 'OTHER'
  | 'TEST'
  | 'STRIPE'
  | 'SSL_COMMERZ';
export type PublicCheckoutPaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'OTHER'
  | 'CARD';

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
  shippingMethodId: string;
  paymentProvider: PublicCheckoutPaymentProvider;
  paymentMethod: PublicCheckoutPaymentMethod;
  customerNote?: string;
  couponCode?: string;
}

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  type: CouponType;
  value: string;
  minimumOrderAmount: string | null;
  maximumDiscountAmount: string | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCouponValidationResult {
  valid: true;
  code: string;
  discount: string;
  subtotal: string;
  finalSubtotal: string;
  currency: string;
}

export interface PublicCheckoutConfirmation {
  orderNumber: string;
  publicReference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentProvider: string | null;
  paymentMethod: string | null;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  shippingMethodName: string | null;
  shippingMethodType: ShippingMethodType | null;
  discountTotal: string;
  taxTotal: string;
  total: string;
  couponCode?: string | null;
  cancelReason?: string | null;
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
  fulfillmentStatus: FulfillmentStatus;
  customerNote: string | null;
  cancelReason: string | null;
  /** True when the store allows guest cancellation and this order is still eligible. */
  canCancel?: boolean;
  createdAt: string;
  items: PublicOrderItemSummary[];
  shippingAddress: PublicOrderAddressSummary | null;
  billingAddress: PublicOrderAddressSummary | null;
  shipments: PublicShipmentTracking[];
  timeline: OrderTimelineEvent[];
}

/* -------------------------------------------------------------------------- */
/* Phase 15 — Super Admin platform console                                     */
/* -------------------------------------------------------------------------- */

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DRAFT';
export type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED';
export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';
export type BillingCycle = 'MONTHLY' | 'SEMI_ANNUAL' | 'YEARLY';

/** Derived lifecycle position; see `subscriptionPhase` in @ecomesta/utils. */
export type SubscriptionPhase =
  | 'TRIAL'
  | 'GRACE'
  | 'LAPSED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface PublicPlanPrice {
  billingCycle: BillingCycle;
  /** Whole-taka price for the full period, derived from the monthly price. */
  amount: number;
  months: number;
  discountPercent: number;
  effectiveMonthly: number;
}

/** Active plan as shown on the pricing page and plan pickers. */
export interface PublicPlan {
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  features: string[];
  highlighted: boolean;
  currency: 'BDT';
  monthlyPrice: number;
  trialMonths: number;
  prices: PublicPlanPrice[];
  /** What the plan unlocks. `null` when the plan sets no limits (everything allowed). */
  limits: PlanLimits | null;
}

/** Features and quotas a subscription plan unlocks, enforced by the API. */
export interface PlanLimits {
  /** Products across all of the business's stores; `null` is unlimited. */
  maxProducts: number | null;
  customDomain: boolean;
  /** SSLCommerz online payments (bKash, Nagad, cards). */
  onlinePayments: boolean;
  stripe: boolean;
  coupons: boolean;
  deliveryZones: boolean;
  /** Every storefront theme; otherwise only the default theme. */
  allThemes: boolean;
}

export type ManualPaymentMethod = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY';
export type BillingPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** An Ecomesta wallet the merchant sends the subscription payment to. */
export interface ManualPaymentAccount {
  method: ManualPaymentMethod;
  label: string;
  number: string;
  /** "Send Money" for personal wallets. */
  transferType: string;
}

/** A subscription payment the merchant reported (merchant view, no internal user ids). */
export interface MerchantBillingPayment {
  id: string;
  planName: string;
  planSlug: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: 'BDT';
  method: ManualPaymentMethod;
  senderNumber: string;
  transactionId: string;
  status: BillingPaymentStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** A submitted payment as the Super Admin reviews it. */
/** A website support chat, as listed for Super Admins. */
export interface AdminSupportConversationSummary {
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  messageCount: number;
  /** The visitor's first message, shortened for the list. */
  firstMessage: string | null;
  handoffReference: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface AdminSupportMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  handoffReason: string | null;
  createdAt: string;
}

export interface AdminSupportConversation extends AdminSupportConversationSummary {
  userAgent: string | null;
  messages: AdminSupportMessage[];
}

export interface AdminBillingPayment extends MerchantBillingPayment {
  payToNumber: string;
  tenant: { id: string; name: string; slug: string };
  submittedBy: { id: string; email: string; name: string | null };
  reviewedBy: { id: string; email: string } | null;
  /** The business's current subscription when the payment was listed. */
  currentSubscription: { status: SubscriptionStatus; planName: string } | null;
}

/** The signed-in merchant's platform subscription (no internal IDs). */
export interface MerchantSubscription {
  tenantName: string;
  canManage: boolean;
  /** A store created at sign-up is offline until its first payment is confirmed. */
  awaitingFirstPayment: boolean;
  /** False until paid subscription billing is switched on. */
  onlinePaymentAvailable: boolean;
  subscription: {
    status: SubscriptionStatus;
    phase: SubscriptionPhase;
    billingCycle: BillingCycle;
    startsAt: string;
    trialEndsAt: string | null;
    endsAt: string | null;
    /** Payment deadline (end of the 7-day grace period), when payment is or will be due. */
    paymentDueBy: string | null;
    currency: 'BDT';
    /** Amount for one billing period of the selected cycle after the trial. */
    amountDue: number;
    plan: { name: string; slug: string; monthlyPrice: number; trialMonths: number; limits: PlanLimits | null };
  } | null;
  /** A payment waiting for Ecomesta to check, if any. */
  pendingPayment: MerchantBillingPayment | null;
}

/** Statuses a Super Admin may assign directly; other states stay system-owned. */
export type AdminAssignableUserStatus = 'ACTIVE' | 'SUSPENDED';
export type AdminAssignableTenantStatus = 'ACTIVE' | 'SUSPENDED';
export type AdminAssignableStoreStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminStats {
  users: { total: number; active: number };
  tenants: { total: number; active: number };
  stores: { total: number; active: number };
  subscriptions: { total: number; active: number };
  orders: { total: number };
  orderRevenueSum: string;
  recentAuditCount: number;
  generatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  platformRole: PlatformRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserTenantMembership {
  id: string;
  role: TenantRole;
  status: MembershipStatus;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; status: TenantStatus };
}

export interface AdminUserStoreMembership {
  id: string;
  role: StoreRole;
  status: MembershipStatus;
  createdAt: string;
  store: {
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    tenantId: string;
  };
}

export interface AdminUserDetail extends AdminUser {
  tenantMemberships: AdminUserTenantMembership[];
  storeMemberships: AdminUserStoreMembership[];
}

export interface AdminTenantSummary {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
}

export interface AdminTenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  counts: { stores: number; users: number };
}

export interface AdminMemberRef {
  id: string;
  role: string;
  status: MembershipStatus;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: UserStatus;
  };
}

export interface AdminTenantDetail {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  memberships: AdminMemberRef[];
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
  }>;
  counts: { stores: number; users: number; orders: number };
  latestSubscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    startsAt: string;
    endsAt: string | null;
    trialEndsAt: string | null;
    createdAt: string;
    plan: {
      id: string;
      name: string;
      slug: string;
      monthlyPrice: string | null;
      yearlyPrice: string | null;
    };
  } | null;
  recentAuditLogs: AdminTenantAuditEntry[];
}

export interface AdminTenantAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  storeId: string | null;
  createdAt: string;
  user: { id: string; email: string } | null;
}

export interface AdminStoreListItem {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  currency: string;
  createdAt: string;
  updatedAt: string;
  tenant: AdminTenantSummary;
}

export interface AdminStoreDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: StoreStatus;
  currency: string;
  timezone: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  tenant: AdminTenantSummary;
  memberships: AdminMemberRef[];
  domains: Array<{
    id: string;
    hostname: string;
    type: string;
    status: string;
    isPrimary: boolean;
    verifiedAt: string | null;
  }>;
  /** Active storefront theme, read-only for the platform admin. */
  theme: {
    name: string;
    slug: string;
    publishedAt: string | null;
  } | null;
  counts: {
    products: number;
    customers: number;
    orders: number;
    inventoryItems: number;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string;
  currency: 'BDT';
  trialMonths: number;
  /** Price for each billing cycle, derived from the monthly price. */
  prices: PublicPlanPrice[];
  active: boolean;
  configuration: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  phase: SubscriptionPhase;
  billingCycle: BillingCycle;
  startsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
  /** End of the payment grace period; null once paid or cancelled. */
  paymentDueBy: string | null;
  amountDue: number;
  createdAt: string;
  updatedAt: string;
  tenant: AdminTenantSummary;
  plan: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    monthlyPrice: string;
    yearlyPrice: string;
    trialMonths: number;
  };
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  tenantId: string | null;
  storeId: string | null;
  userId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string } | null;
}

/* -------------------------------------------------------------------------- */
/* Phase 16 — Storefront theming                                              */
/* -------------------------------------------------------------------------- */

export type ThemeBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type ThemeHeaderLayout = 'classic' | 'centered' | 'minimal';
export type ThemeHeroAlignment = 'left' | 'center' | 'right';
export type ThemeSectionType =
  | 'featured_categories'
  | 'featured_products'
  | 'rich_text'
  | 'custom';
export type ThemeSocialNetwork =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'x'
  | 'youtube'
  | 'tiktok'
  | 'linkedin'
  | 'other';

export interface ThemeMenuItem {
  label: string;
  href: string;
}

export interface ThemeSocialLink {
  network: ThemeSocialNetwork;
  url: string;
}

export interface ThemeHomepageSection {
  type: ThemeSectionType;
  title?: string;
  enabled?: boolean;
}

/** Closed config schema — unknown keys are stripped by the API on write. */
export interface StoreThemeConfig {
  branding?: {
    brandName?: string;
    tagline?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    textColor?: string;
    mutedTextColor?: string;
    borderRadius?: ThemeBorderRadius;
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    baseFontSize?: number;
    headingLetterSpacing?: number;
  };
  announcement?: {
    enabled?: boolean;
    text?: string;
    href?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  header?: {
    layout?: ThemeHeaderLayout;
    sticky?: boolean;
    showSearch?: boolean;
    showCart?: boolean;
    menuItems?: ThemeMenuItem[];
  };
  hero?: {
    enabled?: boolean;
    headline?: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaHref?: string;
    imageUrl?: string;
    alignment?: ThemeHeroAlignment;
    overlayOpacity?: number;
  };
  homepage?: {
    featuredCategories?: string[];
    featuredProducts?: string[];
    sections?: ThemeHomepageSection[];
  };
  footer?: {
    tagline?: string;
    copyright?: string;
    showPaymentIcons?: boolean;
    menuItems?: ThemeMenuItem[];
    socialLinks?: ThemeSocialLink[];
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImageUrl?: string;
  };
}

export interface ThemeSummary {
  id: string;
  name: string;
  slug: string;
  version: string;
  previewImageUrl: string | null;
}

export interface ThemeListItem extends ThemeSummary {
  description: string | null;
  /** The merchant's selected (draft) theme. */
  selected: boolean;
  /** The theme the public storefront currently shows. */
  live: boolean;
}

/**
 * Merchant-facing store theme: the selected (draft) theme plus its last
 * published snapshot. Only publishing changes the live storefront.
 */
export interface StoreTheme {
  id: string;
  theme: ThemeSummary;
  /** Selected as the merchant's draft theme. */
  isActive: boolean;
  /** This selected theme is what the public storefront shows. */
  isLive: boolean;
  /** The theme the public storefront shows, or null before the first publish. */
  liveTheme: (ThemeSummary & { publishedAt: string | null }) | null;
  configuration: StoreThemeConfig;
  publishedConfiguration: StoreThemeConfig | null;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  updatedAt: string;
}

export interface UpdateStoreThemeRequest {
  themeId?: string;
  configuration?: StoreThemeConfig;
}

/** Public storefront theming — published snapshot only, never the draft. */
export interface PublicStoreTheme {
  theme: { slug: string; name: string } | null;
  publishedAt: string | null;
  configuration: StoreThemeConfig;
}

// ---------------------------------------------------------------------------
// Phase 17 — custom domains
// ---------------------------------------------------------------------------

export type DomainType = 'SUBDOMAIN' | 'CUSTOM_DOMAIN';

export type DomainStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'FAILED'
  | 'DISABLED';

/** DNS challenge shown while a custom domain is not yet active. */
export interface DomainVerificationRecord {
  recordType: 'TXT';
  recordName: string;
  /**
   * Raw TXT value — only present on create / regenerate responses.
   * List/get return null; merchants must regenerate if the value was lost.
   */
  recordValue: string | null;
  /** True when a challenge hash is stored server-side. */
  verificationConfigured: boolean;
}

export interface StoreDomain {
  id: string;
  storeId: string;
  hostname: string;
  type: DomainType;
  status: DomainStatus;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** True when a pending challenge hash exists (secret never returned on GET). */
  verificationConfigured: boolean;
  /** Null once the domain is active or for platform subdomains. */
  verification: DomainVerificationRecord | null;
}

export interface StoreDomainList {
  items: StoreDomain[];
  meta: {
    total: number;
    platformRootDomain: string;
    canonicalHostname: string;
  };
}

export interface CreateStoreDomainRequest {
  hostname: string;
}

export interface DeletedStoreDomain {
  id: string;
  hostname: string;
}

/** Public host -> storefront mapping used by edge routing. */
export interface ResolvedStorefrontDomain {
  hostname: string;
  domainType: DomainType;
  isPrimary: boolean;
  store: PublicStore;
  canonicalHostname: string;
}
