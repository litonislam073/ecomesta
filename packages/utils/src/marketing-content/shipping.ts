import type { ContentPage } from './types.js';

export const SHIPPING_PAGES: ContentPage[] = [
  {
    hub: 'shipping',
    slug: 'bangladesh',
    name: 'Bangladesh Delivery',
    title: 'Bangladesh Ecommerce Shipping & Delivery Zones | Ecomesta',
    description:
      'Set delivery charges across all 8 divisions, 64 districts and 552 upazilas of Bangladesh. Customers pick their location at checkout and see the right delivery charge.',
    eyebrow: 'Bangladesh delivery',
    h1: 'Delivery charges that match Bangladesh geography',
    intro:
      'Inside Dhaka, outside Dhaka, or a specific upazila — delivery costs in Bangladesh depend on where the parcel goes. Ecomesta includes the full division, district and upazila list so your charges can follow real delivery areas.',
    summary: 'Division, district and upazila based delivery.',
    highlights: [
      '8 divisions, 64 districts, 552 upazilas and thanas',
      'Cascading address selection at checkout',
      'Location-based delivery charges',
      'Location names saved on every order',
    ],
    sections: [
      {
        heading: 'Built-in Bangladesh locations',
        paragraphs: [
          'Ecomesta ships with Bangladesh’s administrative locations: all 8 divisions, 64 districts and 552 upazilas and thanas. You do not need to type or import location lists yourself.',
        ],
      },
      {
        heading: 'How the delivery charge is chosen',
        flow: [
          'Division',
          'District',
          'Upazila',
          'Shipping zone',
          'Shipping method',
          'Shipping rate',
        ],
        paragraphs: [
          'At checkout the customer selects division, then district, then upazila. Ecomesta finds the shipping zone that covers that location, shows the delivery methods available in it, and calculates the charge on the server.',
        ],
      },
      {
        heading: 'Address details your courier needs',
        paragraphs: [
          'Every order stores the customer’s address with the division, district and upazila names, plus the chosen shipping method and zone. Your team always has the full delivery context, even if you change your zones later.',
        ],
      },
      {
        heading: 'Working with couriers',
        paragraphs: [
          'Steadfast, Pathao, RedX, Paperfly and eCourier are connected: add the API details from your courier account in Settings → Couriers, then book a parcel from any order — the address, phone and cash-on-delivery amount are sent for you — and refresh its delivery status from the order.',
          'Delivery Tiger, CarryBee and Karatoa Courier are not connected for direct booking yet: book deliveries as you do today, then choose the courier on the order’s shipment and add the tracking number so the customer can follow it.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I charge differently inside and outside Dhaka?',
        answer:
          'Yes. Create a zone for Dhaka (by division, district or upazila) and another for the rest of the country, each with its own shipping methods and rates.',
      },
      {
        question: 'Are Pathao, Steadfast or RedX integrated?',
        answer:
          'Yes, on every plan: connect Steadfast, Pathao or RedX (and Paperfly or eCourier) in Settings → Couriers with the API details from your courier account, and book parcels straight from your orders.',
      },
    ],
    related: [
      {
        href: '/shipping/zones',
        label: 'Shipping zones and rates',
        description: 'Flat rates, free shipping and COD rules.',
      },
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'Shipments and tracking numbers.',
      },
      {
        href: '/payments/cash-on-delivery',
        label: 'Cash on Delivery',
        description: 'Pay on delivery per method.',
      },
    ],
  },
  {
    hub: 'shipping',
    slug: 'zones',
    name: 'Shipping Zones & Rates',
    title: 'Shipping Zones, Flat Rates and Free Shipping | Ecomesta',
    description:
      'Group Bangladesh locations into shipping zones, add flat-rate or free delivery methods, set free-shipping thresholds and choose where Cash on Delivery is allowed.',
    eyebrow: 'Shipping zones',
    h1: 'Shipping zones, methods and rates',
    intro:
      'Shipping zones let you group delivery areas and give each one its own delivery options. Keep it simple with two zones, or go as detailed as individual upazilas.',
    summary: 'Zones, flat rates, free shipping and COD eligibility.',
    highlights: [
      'Zones by division, district or upazila',
      'Flat-rate and free delivery methods',
      'Free-shipping threshold per method',
      'COD allowed or blocked per method',
    ],
    sections: [
      {
        heading: 'Shipping zones',
        paragraphs: [
          'A zone is a set of locations — whole divisions, specific districts or individual upazilas. Give zones a priority: when a location matches more than one zone, the higher-priority zone is used. Store-wide methods act as a fallback for locations outside every zone.',
        ],
      },
      {
        heading: 'Shipping methods',
        bullets: [
          'Flat rate — a fixed delivery charge, for example ৳60 inside Dhaka',
          'Free shipping — no delivery charge',
          'Estimated delivery text, such as “2–3 days”, shown to the customer',
          'Sort order to control which option appears first',
        ],
      },
      {
        heading: 'Free-shipping thresholds',
        paragraphs: [
          'Set a minimum order value on a method, and delivery becomes free once the order subtotal (after discounts) reaches it — a simple way to encourage larger orders.',
        ],
      },
      {
        heading: 'Cash on Delivery eligibility',
        paragraphs: [
          'Each method has a COD setting. If the selected method does not allow COD, the option is disabled at checkout and rejected by the server.',
        ],
      },
      {
        heading: 'Shipping snapshots on orders',
        paragraphs: [
          'The method name, type and zone used for an order are stored on the order itself. Editing or deleting a zone later never changes the delivery details of past orders.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do you support weight-based shipping?',
        answer:
          'Delivery charges are currently configured as flat or free rates per method. Weight-based pricing is not configurable from the dashboard.',
      },
      {
        question: 'What if no zone matches the customer’s address?',
        answer:
          'Store-wide shipping methods (not linked to a zone) are offered as the fallback.',
      },
    ],
    related: [
      {
        href: '/shipping/bangladesh',
        label: 'Bangladesh locations',
        description: 'Divisions, districts and upazilas.',
      },
      {
        href: '/features/coupons',
        label: 'Coupons',
        description: 'Discounts that work with free-shipping thresholds.',
      },
      {
        href: '/features/order-management',
        label: 'Order management',
        description: 'Fulfil and ship orders.',
      },
    ],
  },
];
