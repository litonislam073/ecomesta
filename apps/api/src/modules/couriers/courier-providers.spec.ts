import { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '@prisma/client';
import { CourierError, CourierUnavailableError } from './courier-errors';
import type { CourierShipmentInput } from './courier-provider';
import { CourierHttp, CourierTransportError } from './courier.http';
import { ECourierCourierProvider } from './providers/ecourier/ecourier-courier.provider';
import { PaperflyCourierProvider } from './providers/paperfly/paperfly-courier.provider';
import { PathaoCourierProvider } from './providers/pathao/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx/redx-courier.provider';

type Call = { method: string; url: string; headers?: Record<string, string>; body?: unknown };

/** A fake courier server: answers by URL suffix, records every request. */
function fakeHttp(routes: Record<string, { status: number; body: unknown } | (() => never)>) {
  const calls: Call[] = [];
  const http = {
    request: jest.fn(async (params: Call) => {
      calls.push(params);
      const key = Object.keys(routes)
        .sort((a, b) => b.length - a.length)
        .find((suffix) => params.url.endsWith(suffix) || params.url.includes(`${suffix}/`));
      if (!key) return { status: 404, body: null };
      const route = routes[key]!;
      return typeof route === 'function' ? route() : route;
    }),
  } as unknown as CourierHttp;
  return { http, calls };
}

const config = { get: () => undefined } as unknown as ConfigService;

const input: CourierShipmentInput = {
  reference: 'shop-EM-1001',
  recipientName: 'Rahim Uddin',
  recipientPhone: '01711223344',
  recipientAddress: 'House 1, Road 2, Dhanmondi, Dhaka',
  addressLine: 'House 1, Road 2',
  districtName: 'Dhaka',
  upazilaName: 'Dhanmondi',
  postalCode: '1209',
  codAmount: '1250.00',
  orderTotal: '1250.00',
  weightKg: 1,
  itemCount: 2,
  itemDescription: 'T-shirt x2',
  pickup: { name: 'My Shop', phone: '01811223344', address: 'Mirpur 10, Dhaka' },
};

describe('Pathao courier', () => {
  const credentials = { clientId: 'cid', clientSecret: 'secret', username: 'me@shop.com', password: 'pw', storeId: '77' };
  const token = { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } };

  it('issues a token, then books with the store, COD in whole taka and our reference', async () => {
    const { http, calls } = fakeHttp({
      '/issue-token': token,
      '/aladdin/api/v1/orders': { status: 200, body: { code: 200, data: { consignment_id: 'DL1234', order_status: 'Pending' } } },
    });
    const pathao = new PathaoCourierProvider(http, config);
    const booking = await pathao.createShipment(credentials, input);
    expect(booking).toEqual({ providerShipmentId: 'DL1234', trackingCode: 'DL1234', providerStatus: 'Pending' });
    expect(calls[0]!.body).toMatchObject({ client_id: 'cid', client_secret: 'secret', username: 'me@shop.com', password: 'pw', grant_type: 'password' });
    expect(calls[1]!.headers).toEqual({ Authorization: 'Bearer tok-1' });
    expect(calls[1]!.body).toMatchObject({
      store_id: 77,
      merchant_order_id: 'shop-EM-1001',
      recipient_phone: '01711223344',
      amount_to_collect: 1250,
      item_quantity: 2,
      item_weight: 1,
      delivery_type: 48,
      item_type: 2,
    });
  });

  it('reuses the token and maps statuses conservatively', async () => {
    const { http, calls } = fakeHttp({
      '/issue-token': token,
      '/aladdin/api/v1/orders/DL1234': { status: 200, body: { data: { order_status: 'Delivered' } } },
    });
    const pathao = new PathaoCourierProvider(http, config);
    const ref = { providerShipmentId: 'DL1234', reference: null, trackingCode: null };
    expect((await pathao.getShipmentStatus(credentials, ref)).status).toBe(ShipmentStatus.DELIVERED);
    await pathao.getShipmentStatus(credentials, ref);
    expect(calls.filter((c) => c.url.endsWith('/issue-token'))).toHaveLength(1);
    expect(pathao.describeStatus('Pickup_Requested').status).toBe(ShipmentStatus.LABEL_CREATED);
    expect(pathao.describeStatus('On Hold').status).toBeNull();
    expect(pathao.describeStatus('teleported').status).toBeNull();
  });

  it('fills in the first Pathao store when none is given, and rejects a store that is not there', async () => {
    const { http } = fakeHttp({
      '/issue-token': token,
      '/aladdin/api/v1/stores': { status: 200, body: { data: { data: [{ store_id: 501 }, { store_id: 502 }] } } },
    });
    const pathao = new PathaoCourierProvider(http, config);
    await expect(pathao.validateCredentials({ ...credentials, storeId: '' })).resolves.toMatchObject({ storeId: '501' });
    await expect(pathao.validateCredentials({ ...credentials, storeId: '999' })).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
  });

  it('treats a refused token as bad credentials and a field error as a rejected parcel', async () => {
    const refused = new PathaoCourierProvider(fakeHttp({ '/issue-token': { status: 400, body: { message: 'invalid' } } }).http, config);
    await expect(refused.validateCredentials(credentials)).rejects.toMatchObject({ code: 'COURIER_AUTH_FAILED' });

    const { http } = fakeHttp({
      '/issue-token': token,
      '/aladdin/api/v1/orders': { status: 422, body: { message: 'Please fix the given errors', errors: { recipient_phone: ['The recipient phone format is invalid.'] } } },
    });
    const err = await new PathaoCourierProvider(http, config).createShipment(credentials, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CourierError);
    expect((err as CourierError).message).toContain('The recipient phone format is invalid.');
  });

  it('refuses a COD total with paisa before calling Pathao', async () => {
    const { http, calls } = fakeHttp({ '/issue-token': token });
    await expect(new PathaoCourierProvider(http, config).createShipment(credentials, { ...input, codAmount: '99.50' })).rejects.toMatchObject({
      code: 'COURIER_COD_NOT_WHOLE_TAKA',
    });
    expect(calls.some((c) => c.url.endsWith('/aladdin/api/v1/orders'))).toBe(false);
  });
});

describe('RedX courier', () => {
  const credentials = { accessToken: 'redx-token', pickupStoreId: '12' };
  const areas = { status: 200, body: { areas: [{ id: 1, name: 'Dhanmondi', district_name: 'Dhaka' }, { id: 2, name: 'Mirpur', district_name: 'Dhaka' }] } };

  it('lists delivery areas for the booking picker', async () => {
    const redx = new RedxCourierProvider(fakeHttp({ '/areas': areas }).http, config);
    expect(redx.locationSteps.map((s) => s.key)).toEqual(['area']);
    expect(await redx.locationOptions(credentials, 'area')).toEqual([
      { value: '1', label: 'Dhanmondi (Dhaka)' },
      { value: '2', label: 'Mirpur (Dhaka)' },
    ]);
  });

  it('books with the area name from RedX itself, weight in grams and the token header', async () => {
    const { http, calls } = fakeHttp({ '/areas': areas, '/parcel': { status: 201, body: { tracking_id: '21A427TU4BN' } } });
    const booking = await new RedxCourierProvider(http, config).createShipment(credentials, { ...input, location: { area: '2' } });
    expect(booking.providerShipmentId).toBe('21A427TU4BN');
    const create = calls.find((c) => c.url.endsWith('/parcel'))!;
    expect(create.headers).toEqual({ 'API-ACCESS-TOKEN': 'Bearer redx-token' });
    expect(create.body).toMatchObject({
      delivery_area: 'Mirpur',
      delivery_area_id: 2,
      merchant_invoice_id: 'shop-EM-1001',
      cash_collection_amount: '1250',
      parcel_weight: 1000,
      pickup_store_id: 12,
    });
  });

  it('needs an area from the RedX list before booking', async () => {
    const { http, calls } = fakeHttp({ '/areas': areas });
    const redx = new RedxCourierProvider(http, config);
    await expect(redx.createShipment(credentials, input)).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
    await expect(redx.createShipment(credentials, { ...input, location: { area: '999' } })).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
    expect(calls.some((c) => c.url.endsWith('/parcel'))).toBe(false);
  });

  it('reads parcel status and treats a bad token as bad credentials', async () => {
    const { http } = fakeHttp({ '/parcel/info/21A427TU4BN': { status: 200, body: { parcel: { status: 'delivery-in-progress' } } } });
    const result = await new RedxCourierProvider(http, config).getShipmentStatus(credentials, { providerShipmentId: '21A427TU4BN', reference: null, trackingCode: null });
    expect(result.status).toBe(ShipmentStatus.IN_TRANSIT);
    const bad = new RedxCourierProvider(fakeHttp({ '/areas': { status: 401, body: null } }).http, config);
    await expect(bad.validateCredentials(credentials)).rejects.toMatchObject({ code: 'COURIER_AUTH_FAILED' });
  });
});

describe('Paperfly courier', () => {
  const credentials = { username: 'shop', password: 'pw', paperflyKey: 'key-1', pickupThana: 'Mirpur', pickupDistrict: 'Dhaka' };

  it('books with basic auth, the paperfly key, pickup details and the order thana/district', async () => {
    const { http, calls } = fakeHttp({ '/OrderPlacement': { status: 200, body: { response_code: 200, success: { message: 'ok', tracking_number: 'PF-778' } } } });
    const booking = await new PaperflyCourierProvider(http, config).createShipment(credentials, input);
    expect(booking.providerShipmentId).toBe('PF-778');
    expect(calls[0]!.headers).toEqual({ Authorization: `Basic ${Buffer.from('shop:pw').toString('base64')}`, paperflykey: 'key-1' });
    expect(calls[0]!.body).toMatchObject({
      merOrderRef: 'shop-EM-1001',
      pickMerchantName: 'My Shop',
      pickMerchantThana: 'Mirpur',
      pickMerchantDistrict: 'Dhaka',
      customerThana: 'Dhanmondi',
      customerDistrict: 'Dhaka',
      packagePrice: '1250',
      custPhone: '01711223344',
    });
  });

  it('asks for pickup details and a thana before calling Paperfly', async () => {
    const { http, calls } = fakeHttp({});
    const paperfly = new PaperflyCourierProvider(http, config);
    await expect(paperfly.createShipment(credentials, { ...input, pickup: { name: null, phone: null, address: null } })).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
    await expect(paperfly.createShipment(credentials, { ...input, upazilaName: null })).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
    expect(calls).toHaveLength(0);
  });

  it('reads the furthest milestone reached', async () => {
    const { http } = fakeHttp({
      '/API-Order-Tracking': { status: 200, body: { success: { trackingStatus: [{ Pick: '2026-10-01', inTransit: '2026-10-02', Delivered: '' }] } } },
    });
    const result = await new PaperflyCourierProvider(http, config).getShipmentStatus(credentials, { providerShipmentId: null, reference: 'shop-EM-1001', trackingCode: null });
    expect(result).toMatchObject({ status: ShipmentStatus.IN_TRANSIT, label: 'In transit' });
  });
});

describe('eCourier courier', () => {
  const credentials = { userId: 'U1', apiKey: 'K1', apiSecret: 'S1' };
  const location = { package: '#2505', city: 'Dhaka', thana: 'Dhanmondi', postcode: '1209', area: 'Dhanmondi 27' };

  it('walks package → city → thana → post code → area with the documented calls', async () => {
    const { http, calls } = fakeHttp({
      '/packages': { status: 200, body: [{ package_name: 'Next day', package_code: '#2505', shipping_charge: '60', coverage: 'Inside Dhaka' }] },
      '/city-list': { status: 200, body: [{ name: 'Dhaka', value: 'Dhaka' }] },
      '/thana-list': { status: 200, body: { success: true, message: [{ name: 'Dhanmondi', value: 'Dhanmondi' }] } },
      '/postcode-list': { status: 200, body: { success: true, message: [{ name: '1209(Dhanmondi)', value: '1209' }] } },
      '/area-list': { status: 200, body: { success: true, message: [{ name: 'Dhanmondi 27', value: 'Dhanmondi 27' }] } },
    });
    const ecourier = new ECourierCourierProvider(http, config);
    expect(await ecourier.locationOptions(credentials, 'package', {})).toEqual([{ value: '#2505', label: 'Next day — Inside Dhaka, ৳60' }]);
    expect(await ecourier.locationOptions(credentials, 'city', {})).toEqual([{ value: 'Dhaka', label: 'Dhaka' }]);
    expect(await ecourier.locationOptions(credentials, 'thana', { city: 'Dhaka' })).toEqual([{ value: 'Dhanmondi', label: 'Dhanmondi' }]);
    expect(await ecourier.locationOptions(credentials, 'postcode', { city: 'Dhaka', thana: 'Dhanmondi' })).toEqual([{ value: '1209', label: '1209(Dhanmondi)' }]);
    expect(await ecourier.locationOptions(credentials, 'area', { postcode: '1209' })).toEqual([{ value: 'Dhanmondi 27', label: 'Dhanmondi 27' }]);
    // A later step without its earlier choices asks nothing.
    expect(await ecourier.locationOptions(credentials, 'area', {})).toEqual([]);
    expect(calls.every((c) => c.method === 'POST')).toBe(true);
    expect(calls[0]!.headers).toEqual({ 'USER-ID': 'U1', 'API-KEY': 'K1', 'API-SECRET': 'S1' });
  });

  it('places the order with the picked places and a 40-character address', async () => {
    const { http, calls } = fakeHttp({ '/order-place': { status: 200, body: { response_code: 200, message: 'Order Submitted', ID: 'ECR1030102170392' } } });
    const booking = await new ECourierCourierProvider(http, config).createShipment(credentials, {
      ...input,
      addressLine: 'House 1, Road 2, Block C, A Very Long Street Name Here',
      location,
    });
    expect(booking.providerShipmentId).toBe('ECR1030102170392');
    const body = calls[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      recipient_city: 'Dhaka',
      recipient_thana: 'Dhanmondi',
      recipient_area: 'Dhanmondi 27',
      recipient_zip: '1209',
      package_code: '#2505',
      product_price: 1250,
      payment_method: 'COD',
      product_id: 'shop-EM-1001',
    });
    expect((body.recipient_address as string).length).toBeLessThanOrEqual(40);
  });

  it('needs every place picked, and shows the real eCourier reason on a refusal', async () => {
    const missing = new ECourierCourierProvider(fakeHttp({}).http, config);
    await expect(missing.createShipment(credentials, { ...input, location: { ...location, area: '' } })).rejects.toMatchObject({ code: 'COURIER_VALIDATION_FAILED' });
    const { http } = fakeHttp({ '/order-place': { status: 400, body: { errors: ['Invalid Package', 'The Package code does not exist or assigned to you'], response_code: 400 } } });
    const err = await new ECourierCourierProvider(http, config).createShipment(credentials, { ...input, location }).catch((e: unknown) => e);
    expect((err as CourierError).message).toContain('Invalid Package');
  });

  it('reads the newest tracking status', async () => {
    const { http } = fakeHttp({
      '/track': { status: 200, body: { response_code: 200, query_data: [{ status: [['On the way to Delivery', '', '2026-10-02'], ['Picked Up', '', '2026-10-01']] }] } },
    });
    const result = await new ECourierCourierProvider(http, config).getShipmentStatus(credentials, { providerShipmentId: 'ECR1', reference: null, trackingCode: null });
    expect(result).toMatchObject({ status: ShipmentStatus.IN_TRANSIT, label: 'Out for delivery' });
  });
});

describe('shared courier failure rules', () => {
  it('treats a lost answer or a 5xx as uncertain (the courier may have acted)', async () => {
    const credentials = { userId: 'U1', apiKey: 'K1', apiSecret: 'S1' };
    const location = { package: '#1', city: 'Dhaka', thana: 'Dhanmondi', postcode: '1209', area: 'A' };
    const lost = fakeHttp({
      '/order-place': () => {
        throw new CourierTransportError('timeout');
      },
    });
    await expect(new ECourierCourierProvider(lost.http, config).createShipment(credentials, { ...input, location })).rejects.toBeInstanceOf(CourierUnavailableError);
    const down = fakeHttp({ '/order-place': { status: 502, body: null } });
    await expect(new ECourierCourierProvider(down.http, config).createShipment(credentials, { ...input, location })).rejects.toBeInstanceOf(CourierUnavailableError);
  });
});
