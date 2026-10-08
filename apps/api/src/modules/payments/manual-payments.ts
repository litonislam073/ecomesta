import { UnprocessableEntityException } from '@nestjs/common';
import { PaymentMethod, PaymentProvider, Prisma } from '@prisma/client';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';

/** The store's own (offline) payment options, as stored on the store. */
export interface ManualPaymentSettings {
  paymentCodEnabled: boolean;
  paymentBankTransferEnabled: boolean;
  paymentBankTransferDetails: string | null;
  paymentOtherEnabled: boolean;
  paymentOtherDetails: string | null;
}

export const MANUAL_PAYMENT_SELECT = {
  paymentCodEnabled: true,
  paymentBankTransferEnabled: true,
  paymentBankTransferDetails: true,
  paymentOtherEnabled: true,
  paymentOtherDetails: true,
} as const satisfies Prisma.StoreSelect;

export interface OfflinePaymentOption {
  provider: PaymentProvider;
  method: PaymentMethod;
  /** What the shopper needs to pay (bank details, instructions); null when none. */
  details: string | null;
}

/** The offline options the store offers at checkout, in display order. */
export function offlinePaymentOptions(store: ManualPaymentSettings): OfflinePaymentOption[] {
  const options: OfflinePaymentOption[] = [];
  if (store.paymentCodEnabled) options.push({ provider: PaymentProvider.COD, method: PaymentMethod.CASH, details: null });
  if (store.paymentBankTransferEnabled) {
    options.push({ provider: PaymentProvider.OTHER, method: PaymentMethod.BANK_TRANSFER, details: store.paymentBankTransferDetails });
  }
  if (store.paymentOtherEnabled) {
    options.push({ provider: PaymentProvider.OTHER, method: PaymentMethod.OTHER, details: store.paymentOtherDetails });
  }
  return options;
}

/** Whether checkout may use this offline provider/method pair (online providers are checked elsewhere). */
export function offlineOptionAllowed(store: ManualPaymentSettings, provider: string, method: string): boolean {
  if (provider === PaymentProvider.COD) return store.paymentCodEnabled && method === PaymentMethod.CASH;
  if (provider === PaymentProvider.OTHER) {
    if (method === PaymentMethod.BANK_TRANSFER) return store.paymentBankTransferEnabled;
    if (method === PaymentMethod.OTHER) return store.paymentOtherEnabled;
    return false;
  }
  return true;
}

/**
 * A store must always leave shoppers a way to pay. Refuses a change that would
 * turn off the last one: every offline option off and no online provider that
 * is enabled and included in the plan.
 */
export async function assertStoreKeepsAPaymentOption(
  db: Prisma.TransactionClient | { paymentProviderConfig: Prisma.TransactionClient['paymentProviderConfig'] },
  entitlements: PlanEntitlementsService,
  storeId: string,
  next: { manual: Pick<ManualPaymentSettings, 'paymentCodEnabled' | 'paymentBankTransferEnabled' | 'paymentOtherEnabled'>; disablingProvider?: PaymentProvider },
): Promise<void> {
  const { manual } = next;
  if (manual.paymentCodEnabled || manual.paymentBankTransferEnabled || manual.paymentOtherEnabled) return;
  const online = await db.paymentProviderConfig.findMany({
    where: { storeId, enabled: true, ...(next.disablingProvider ? { provider: { not: next.disablingProvider } } : {}) },
    select: { provider: true },
  });
  for (const row of online) {
    if (await entitlements.storeAllowsProvider(storeId, row.provider)) return;
  }
  throw new UnprocessableEntityException({
    message:
      'Customers need at least one way to pay. Keep Cash on delivery (or another option) on, or turn on an online provider first.',
    error: 'PAYMENT_OPTION_REQUIRED',
  });
}
