'use client';

import type { OrderAddressSnapshot, OrderDetail, OrderPaymentRef } from '@ecomesta/types';
import { InvoiceSheet, formatInvoiceDate } from '@ecomesta/ui';

export interface InvoiceStore {
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export function paymentMethodLabel(payment: Pick<OrderPaymentRef, 'provider' | 'method'> | undefined): string {
  if (!payment) return 'Cash on delivery';
  if (payment.provider === 'COD') return 'Cash on delivery';
  if (payment.method === 'BANK_TRANSFER') return 'Bank transfer';
  if (payment.provider === 'SSL_COMMERZ') return 'Online payment (SSLCommerz)';
  if (payment.provider === 'STRIPE') return 'Card (Stripe)';
  if (payment.provider === 'BKASH') return 'bKash';
  if (payment.provider === 'NAGAD') return 'Nagad';
  return 'Other';
}

function addressLines(address: OrderAddressSnapshot | undefined): string[] {
  if (!address) return [];
  const area = [address.upazilaName, address.districtName, address.divisionName].filter(Boolean).join(', ');
  const cityLine = area || [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
  return [
    [address.firstName, address.lastName].filter(Boolean).join(' ') || 'Customer',
    address.phone ?? '',
    address.email ?? '',
    address.company ?? '',
    address.addressLine1,
    address.addressLine2 ?? '',
    address.landmark ? `Landmark: ${address.landmark}` : '',
    cityLine,
  ];
}

/** Customer invoice for one order, ready to print and send with the parcel. */
export function OrderInvoice({ order, store }: { order: OrderDetail; store: InvoiceStore }) {
  const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
  const billing = order.addresses.find((a) => a.type === 'BILLING');
  const payment = [...order.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const paid = order.paymentStatus === 'PAID';
  const cancelled = order.status === 'CANCELLED';
  const discount = Number(order.discountTotal);
  const shippingTotal = Number(order.shippingTotal);
  const tax = Number(order.taxTotal);
  const method = paymentMethodLabel(payment);

  const parties = [{ title: 'Bill to', lines: addressLines(shipping ?? billing) }];
  if (billing && shipping && billing.addressLine1 !== shipping.addressLine1) {
    parties[0] = { title: 'Ship to', lines: addressLines(shipping) };
    parties.push({ title: 'Bill to', lines: addressLines(billing) });
  } else {
    parties.push({
      title: 'Delivery',
      lines: [
        order.shippingMethodName ?? 'Standard delivery',
        order.shippingZoneName ? `Zone: ${order.shippingZoneName}` : '',
        `Payment: ${method}`,
      ],
    });
  }

  return (
    <InvoiceSheet
      sellerName={store.name}
      sellerLogoUrl={store.logoUrl}
      sellerLines={[store.address, store.phone, store.email]}
      invoiceNumber={`#${order.orderNumber}`}
      stamp={
        cancelled
          ? { label: 'Cancelled', tone: 'void' }
          : paid
            ? { label: 'Paid', tone: 'paid' }
            : { label: 'Due', tone: 'due' }
      }
      meta={[
        { label: 'Order date', value: formatInvoiceDate(order.createdAt) },
        { label: 'Payment', value: method },
      ]}
      parties={parties}
      currency={order.currency}
      lines={order.items.map((item) => ({
        description: item.productName,
        detail: [item.variantName, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(' · ') || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
      }))}
      totals={[
        { label: 'Subtotal', amount: order.subtotal },
        ...(discount > 0
          ? [{ label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, amount: discount, negative: true }]
          : []),
        { label: 'Delivery charge', amount: shippingTotal },
        ...(tax > 0 ? [{ label: 'Tax', amount: tax }] : []),
      ]}
      grandTotal={{
        label: cancelled ? 'Total' : paid ? 'Total paid' : 'Amount due',
        amount: order.grandTotal,
      }}
      notes={
        order.customerNote ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">Customer note</p>
            <p className="mt-1 whitespace-pre-line">{order.customerNote}</p>
          </>
        ) : undefined
      }
      footer={`Thank you for shopping with ${store.name}!`}
    />
  );
}
