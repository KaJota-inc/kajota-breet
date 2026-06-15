/**
 * @jest-environment node
 *
 * `HttpBreetClient` is a thin HTTP wrapper, but the few invariants
 * it carries — trailing-slash normalisation on baseUrl, header +
 * body shape, 404 → null on getDeposit — are easy to break and
 * tedious to debug in the wild. These tests pin them.
 */
/// <reference types="jest" />

import { HttpBreetClient } from './client';
import type { BreetDeposit, BreetDepositAddress, CreateAddressInput } from './types';

/** Build a fake fetch that records every call + returns a scripted Response. */
function recordingFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url.toString();
    const i = init ?? {};
    calls.push({ url: u, init: i });
    return handler(u, i);
  }) as unknown as typeof globalThis.fetch;
  return { fetch: fn, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as unknown as Response;
}

const ADDRESS: BreetDepositAddress = {
  id: 'addr-1',
  coin: 'USDT-TRC20',
  address: 'TXyz',
  settlementCurrency: 'NGN',
};

const DEPOSIT: BreetDeposit = {
  id: 'dep-1',
  addressId: 'addr-1',
  status: 'settled',
  coin: 'USDT-TRC20',
  amountSettled: '4500',
  settlementCurrency: 'NGN',
  createdAt: 1,
  updatedAt: 2,
};

describe('HttpBreetClient', () => {
  it('POSTs the create-address payload + forwards the auth header', async () => {
    const { fetch, calls } = recordingFetch(() => jsonResponse(200, ADDRESS));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com',
      authorization: 'Bearer xyz',
      fetch,
    });

    const input: CreateAddressInput = {
      coin: 'USDT-TRC20',
      amountExpected: '10',
      reference: 'order-1',
    };
    const out = await client.createDepositAddress(input);

    expect(out).toEqual(ADDRESS);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://api.example.com/breet/deposit-address');
    expect(call.init.method).toBe('POST');
    expect(call.init.body).toBe(JSON.stringify(input));
    const headers = call.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer xyz');
    expect(headers['content-type']).toBe('application/json');
  });

  it('normalises a trailing slash on baseUrl', async () => {
    const { fetch, calls } = recordingFetch(() => jsonResponse(200, ADDRESS));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com///',
      authorization: 'Bearer xyz',
      fetch,
    });

    await client.createDepositAddress({ coin: 'BTC' });

    expect(calls[0]?.url).toBe('https://api.example.com/breet/deposit-address');
  });

  it('throws a descriptive error on non-2xx from createDepositAddress', async () => {
    const { fetch } = recordingFetch(() => jsonResponse(400, { error: 'bad coin' }));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com',
      authorization: 'Bearer xyz',
      fetch,
    });

    await expect(client.createDepositAddress({ coin: 'BAD' })).rejects.toThrow(/400/);
  });

  it('GETs the deposit by addressId + URL-encodes it', async () => {
    const { fetch, calls } = recordingFetch(() => jsonResponse(200, DEPOSIT));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com',
      authorization: 'Bearer xyz',
      fetch,
    });

    const out = await client.getDeposit('addr/with-slash');
    expect(out).toEqual(DEPOSIT);
    expect(calls[0]?.url).toBe(
      'https://api.example.com/breet/deposit-address/addr%2Fwith-slash',
    );
    expect(calls[0]?.init.method).toBe('GET');
  });

  it('returns null on 404 from getDeposit (address exists, no deposit yet)', async () => {
    const { fetch } = recordingFetch(() => jsonResponse(404, { error: 'not found' }));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com',
      authorization: 'Bearer xyz',
      fetch,
    });

    const out = await client.getDeposit('addr-1');
    expect(out).toBeNull();
  });

  it('throws on non-404 non-2xx from getDeposit', async () => {
    const { fetch } = recordingFetch(() => jsonResponse(503, { error: 'upstream down' }));
    const client = new HttpBreetClient({
      baseUrl: 'https://api.example.com',
      authorization: 'Bearer xyz',
      fetch,
    });

    await expect(client.getDeposit('addr-1')).rejects.toThrow(/503/);
  });
});
