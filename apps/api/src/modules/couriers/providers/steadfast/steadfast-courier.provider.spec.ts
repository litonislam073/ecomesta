import { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '@prisma/client';
import { courierFailure, type CourierFailure } from '../../courier-errors';
import { STEADFAST_DEFAULT_BASE_URL, SteadfastCourierProvider, steadfastCodAmount } from './steadfast-courier.provider';
import { SteadfastHttp, SteadfastTransportError } from './steadfast.http';

const credentials = { apiKey: 'sf_api_key_123456', secretKey: 'sf_secret_key_abcdef' };
const input = {
  reference: 'shop-EM-100001',
  recipientName: 'Ada Lovelace',
  recipientPhone: '01711000000',
  recipientAddress: 'House 1, Road 2, Dhanmondi, Dhaka',
  codAmount: '1250.00',
  note: 'Call before delivery',
};

function setup(env: Record<string, string> = {}) {
  const http = { request: jest.fn() };
  const provider = new SteadfastCourierProvider(
    http as unknown as SteadfastHttp,
    { get: (key: string) => env[key] } as unknown as ConfigService,
  );
  return { http, provider };
}

async function caught(promise: Promise<unknown>): Promise<CourierFailure & { message: string }> {
  try {
    await promise;
  } catch (err) {
    const failure = courierFailure(err);
    expect(failure).not.toBeNull();
    // A merchant-facing error never carries the credentials.
    expect(JSON.stringify((err as { getResponse(): unknown }).getResponse())).not.toMatch(/sf_api_key|sf_secret_key/);
    return err as CourierFailure & { message: string };
  }
  throw new Error('expected a courier failure');
}

describe('SteadfastCourierProvider', () => {
  it('books a parcel with the documented create_order payload and auth headers', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValue({
      status: 200,
      body: { status: 200, message: 'Consignment has been created successfully.', consignment: { consignment_id: 1424107, invoice: input.reference, tracking_code: '15BAEB8A', status: 'in_review' } },
    });

    await expect(provider.createShipment(credentials, input)).resolves.toEqual({
      providerShipmentId: '1424107',
      trackingCode: '15BAEB8A',
      providerStatus: 'in_review',
    });
    expect(http.request).toHaveBeenCalledWith({
      method: 'POST',
      url: `${STEADFAST_DEFAULT_BASE_URL}/create_order`,
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
      body: {
        invoice: 'shop-EM-100001',
        recipient_name: 'Ada Lovelace',
        recipient_phone: '01711000000',
        recipient_address: 'House 1, Road 2, Dhanmondi, Dhaka',
        cod_amount: 1250,
        note: 'Call before delivery',
      },
    });
    expect(STEADFAST_DEFAULT_BASE_URL).toBe('https://portal.packzy.com/api/v1');
  });

  describe('cod_amount is the integer Steadfast documents', () => {
    it.each([
      ['1250.00', 1250],
      ['1250', 1250],
      ['0.00', 0],
      ['9999999999.00', 9999999999],
    ])('sends %s as the integer %d', (value, expected) => {
      const sent = steadfastCodAmount(value);
      expect(sent).toBe(expected);
      expect(Number.isInteger(sent)).toBe(true);
    });

    it.each(['1250.50', '1250.01', '0.99'])('refuses %s instead of rounding it, before calling Steadfast', async (value) => {
      const { http, provider } = setup();
      const err = await caught(provider.createShipment(credentials, { ...input, codAmount: value }));
      expect(err).toMatchObject({ code: 'COURIER_COD_NOT_WHOLE_TAKA', outcome: 'rejected' });
      expect(err.message).toContain(`BDT ${value}`);
      expect(http.request).not.toHaveBeenCalled();
    });

    it('never accepts a negative or non-numeric amount', () => {
      expect(() => steadfastCodAmount('-1.00')).toThrow();
      expect(() => steadfastCodAmount('abc')).toThrow();
    });
  });

  it('uses STEADFAST_BASE_URL when the server sets one', async () => {
    const { http, provider } = setup({ STEADFAST_BASE_URL: 'https://steadfast.test/api/v1/' });
    http.request.mockResolvedValue({ status: 200, body: { status: 200, current_balance: 0 } });
    await provider.validateCredentials(credentials);
    expect(http.request.mock.calls[0][0].url).toBe('https://steadfast.test/api/v1/get_balance');
  });

  it('reports field validation errors as a rejected booking, with the field names', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValue({ status: 200, body: { status: 400, errors: { invoice: ['The invoice has already been taken.'] } } });
    const err = await caught(provider.createShipment(credentials, input));
    expect(err.code).toBe('COURIER_VALIDATION_FAILED');
    expect(err.outcome).toBe('rejected');
    expect(err.fields).toEqual(['invoice']);
    expect(err.message).toContain('The invoice has already been taken.');
  });

  it.each([
    ['HTTP 401', { status: 401, body: { message: 'Unauthenticated.' } }, 'COURIER_AUTH_FAILED', 'rejected'],
    ['HTTP 429', { status: 429, body: null }, 'COURIER_RATE_LIMITED', 'rejected'],
    ['HTTP 500', { status: 500, body: null }, 'COURIER_UNAVAILABLE', 'uncertain'],
    ['HTTP 200 with an unreadable body', { status: 200, body: null }, 'COURIER_BAD_RESPONSE', 'uncertain'],
    ['HTTP 200 without a consignment', { status: 200, body: { status: 200 } }, 'COURIER_BAD_RESPONSE', 'uncertain'],
  ])('maps %s to %s (%s)', async (_label, response, code, outcome) => {
    const { http, provider } = setup();
    http.request.mockResolvedValue(response);
    const err = await caught(provider.createShipment(credentials, input));
    expect(err.code).toBe(code);
    expect(err.outcome).toBe(outcome);
  });

  it.each(['timeout', 'network'] as const)('treats a %s as uncertain (the parcel may exist)', async (kind) => {
    const { http, provider } = setup();
    http.request.mockRejectedValue(new SteadfastTransportError(kind));
    const err = await caught(provider.createShipment(credentials, input));
    expect(err.code).toBe('COURIER_UNAVAILABLE');
    expect(err.outcome).toBe('uncertain');
  });

  it('checks credentials with the read-only balance call and rejects a non-200 answer', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValueOnce({ status: 200, body: { status: 200, current_balance: 1500 } });
    await expect(provider.validateCredentials(credentials)).resolves.toBeUndefined();
    expect(http.request.mock.calls[0][0]).toMatchObject({ method: 'GET', url: `${STEADFAST_DEFAULT_BASE_URL}/get_balance` });

    http.request.mockResolvedValueOnce({ status: 200, body: { status: 401, message: 'Invalid credentials' } });
    expect((await caught(provider.validateCredentials(credentials))).code).toBe('COURIER_AUTH_FAILED');
  });

  it('reads status by consignment id, else by invoice, and maps it', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValue({ status: 200, body: { status: 200, delivery_status: 'delivered' } });
    await expect(provider.getShipmentStatus(credentials, { providerShipmentId: '1424107', reference: 'shop-EM-1', trackingCode: 'X' })).resolves.toEqual({
      providerStatus: 'delivered',
      status: ShipmentStatus.DELIVERED,
      label: 'Delivered',
    });
    expect(http.request.mock.calls[0][0].url).toBe(`${STEADFAST_DEFAULT_BASE_URL}/status_by_cid/1424107`);

    await provider.getShipmentStatus(credentials, { providerShipmentId: null, reference: 'shop-EM-1', trackingCode: null });
    expect(http.request.mock.calls[1][0].url).toBe(`${STEADFAST_DEFAULT_BASE_URL}/status_by_invoice/shop-EM-1`);
  });

  it('never maps an unknown status to delivered', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValue({ status: 200, body: { status: 200, delivery_status: 'teleported' } });
    const result = await provider.getShipmentStatus(credentials, { providerShipmentId: '1', reference: null, trackingCode: null });
    expect(result.status).toBeNull();
    expect(result.providerStatus).toBe('teleported');
  });

  it('reports an unknown parcel as not found', async () => {
    const { http, provider } = setup();
    http.request.mockResolvedValue({ status: 404, body: { status: 404, message: 'Consignment not found' } });
    expect((await caught(provider.getShipmentStatus(credentials, { providerShipmentId: '999', reference: null, trackingCode: null }))).code).toBe(
      'COURIER_SHIPMENT_NOT_FOUND',
    );
  });

  it('offers no cancellation and no tracking URL (Steadfast documents neither)', () => {
    const { provider } = setup();
    expect(provider.supportsCancellation).toBe(false);
    expect(provider.trackingUrl()).toBeNull();
  });
});
