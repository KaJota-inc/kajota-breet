/**
 * @jest-environment node
 *
 * `runBreetDeposit` is the pure async core of the `useBreetDeposit`
 * hook. Testing it directly avoids spinning up a renderer (same
 * pattern as `loadSealedKey` / `pollForOwnedTokenWith`).
 *
 * Pins the deposit lifecycle that drives `BreetDepositModal`:
 *   creating → awaiting → (detected →) settled
 *                              ↓
 *                          expired (timeout / explicit)
 *                              ↓
 *                          error (network)
 */
/// <reference types="jest" />

import type { BreetClient } from './client';
import type { BreetDeposit, BreetDepositAddress, CreateAddressInput } from './types';
import { type BreetDepositState, runBreetDeposit } from './useBreetDeposit';

const ADDRESS: BreetDepositAddress = {
  id: 'addr-1',
  coin: 'USDT-TRC20',
  address: 'TXyz...usdtaddress',
  qrCode: 'tron:TXyz...usdtaddress?amount=10',
  settlementCurrency: 'NGN',
};

function makeDeposit(overrides: Partial<BreetDeposit> = {}): BreetDeposit {
  return {
    id: 'dep-1',
    addressId: ADDRESS.id,
    status: 'pending',
    coin: 'USDT-TRC20',
    settlementCurrency: 'NGN',
    createdAt: 1700000000,
    updatedAt: 1700000000,
    ...overrides,
  };
}

const INPUT: CreateAddressInput = { coin: 'USDT-TRC20' };

/**
 * Build a `BreetClient` stub with scripted responses per call. Each
 * call to `getDeposit` returns the next entry from `depositResponses`
 * — once that array is exhausted, returns null forever.
 */
function stubClient(opts: {
  address?: BreetDepositAddress;
  addressError?: Error;
  depositResponses?: Array<BreetDeposit | null | Error>;
}): { client: BreetClient; getDepositCalls: number } {
  let calls = 0;
  const client: BreetClient = {
    async createDepositAddress() {
      if (opts.addressError) throw opts.addressError;
      return opts.address ?? ADDRESS;
    },
    async getDeposit() {
      const r = opts.depositResponses?.[calls];
      calls++;
      if (r instanceof Error) throw r;
      return r ?? null;
    },
  };
  return {
    client,
    get getDepositCalls() {
      return calls;
    },
  };
}

function captureStates(): {
  states: BreetDepositState[];
  onState: (state: BreetDepositState) => void;
} {
  const states: BreetDepositState[] = [];
  return { states, onState: state => states.push(state) };
}

/** Mocked clock + delay (zero real waiting). */
function makeClock() {
  const state = { now: 0, delays: 0 };
  return {
    state,
    now: () => state.now,
    delay: async (ms: number) => {
      state.delays++;
      state.now += ms;
    },
  };
}

describe('runBreetDeposit', () => {
  it('transitions creating → awaiting → settled on a clean inbound payment', async () => {
    const settled = makeDeposit({ status: 'settled', amountSettled: '4500' });
    const { client } = stubClient({
      depositResponses: [null, settled],
    });
    const cap = captureStates();
    const clock = makeClock();

    await runBreetDeposit({
      client,
      input: INPUT,
      onState: cap.onState,
      intervalMs: 1_000,
      timeoutMs: 60_000,
      now: clock.now,
      delay: clock.delay,
    });

    expect(cap.states.map(s => s.kind)).toEqual(['creating', 'awaiting', 'settled']);
    const final = cap.states[2];
    if (final?.kind === 'settled') {
      expect(final.deposit.amountSettled).toBe('4500');
      expect(final.address.id).toBe(ADDRESS.id);
    }
  });

  it('surfaces the detected state before settled (UI can flip the badge to "received")', async () => {
    const detected = makeDeposit({ status: 'detected' });
    const settled = makeDeposit({ status: 'settled' });
    const { client } = stubClient({
      depositResponses: [detected, settled],
    });
    const cap = captureStates();
    const clock = makeClock();

    await runBreetDeposit({
      client,
      input: INPUT,
      onState: cap.onState,
      intervalMs: 1_000,
      timeoutMs: 60_000,
      now: clock.now,
      delay: clock.delay,
    });

    expect(cap.states.map(s => s.kind)).toEqual([
      'creating',
      'awaiting',
      'detected',
      'settled',
    ]);
  });

  it('exits with error when address creation throws', async () => {
    const { client } = stubClient({
      addressError: new Error('429 rate limited'),
    });
    const cap = captureStates();
    const clock = makeClock();

    await runBreetDeposit({
      client,
      input: INPUT,
      onState: cap.onState,
      now: clock.now,
      delay: clock.delay,
    });

    expect(cap.states.map(s => s.kind)).toEqual(['creating', 'error']);
    const last = cap.states[1];
    if (last?.kind === 'error') expect(last.reason).toMatch(/rate limited/);
  });

  it('tolerates transient getDeposit failures and keeps polling', async () => {
    const settled = makeDeposit({ status: 'settled' });
    const { client } = stubClient({
      depositResponses: [new Error('socket hang up'), null, settled],
    });
    const cap = captureStates();
    const clock = makeClock();
    // Silence the warn that the helper logs on transient failures.
    /* eslint-disable no-console */
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      await runBreetDeposit({
        client,
        input: INPUT,
        onState: cap.onState,
        intervalMs: 1_000,
        timeoutMs: 60_000,
        now: clock.now,
        delay: clock.delay,
      });
    } finally {
      console.warn = originalWarn;
    }
    /* eslint-enable no-console */
    expect(cap.states.map(s => s.kind)).toEqual(['creating', 'awaiting', 'settled']);
  });

  it('exits as expired when the deadline elapses without a terminal state', async () => {
    // Stays pending indefinitely → loop hits the deadline.
    const responses: Array<BreetDeposit | null> = Array.from({ length: 100 }, () => null);
    const { client } = stubClient({ depositResponses: responses });
    const cap = captureStates();
    const clock = makeClock();

    await runBreetDeposit({
      client,
      input: INPUT,
      onState: cap.onState,
      intervalMs: 1_000,
      timeoutMs: 5_000,
      now: clock.now,
      delay: clock.delay,
    });

    expect(cap.states[cap.states.length - 1]?.kind).toBe('expired');
  });

  it("exits early when the deposit's own status is 'expired'", async () => {
    const expired = makeDeposit({ status: 'expired' });
    const { client } = stubClient({ depositResponses: [expired] });
    const cap = captureStates();
    const clock = makeClock();

    await runBreetDeposit({
      client,
      input: INPUT,
      onState: cap.onState,
      intervalMs: 1_000,
      timeoutMs: 60_000,
      now: clock.now,
      delay: clock.delay,
    });

    expect(cap.states.map(s => s.kind)).toEqual(['creating', 'awaiting', 'expired']);
  });

  it('aborts before address creation if the signal is already cancelled (UI dismissed)', async () => {
    let createdAddresses = 0;
    const client: BreetClient = {
      async createDepositAddress() {
        createdAddresses++;
        return ADDRESS;
      },
      async getDeposit() {
        return null;
      },
    };
    const cap = captureStates();
    const clock = makeClock();
    const signal = { cancelled: false };

    // Cancel right before the first getDeposit poll fires.
    const result = runBreetDeposit({
      client,
      input: INPUT,
      onState: state => {
        cap.onState(state);
        if (state.kind === 'awaiting') signal.cancelled = true;
      },
      signal,
      intervalMs: 1_000,
      timeoutMs: 60_000,
      now: clock.now,
      delay: clock.delay,
    });
    await result;

    expect(createdAddresses).toBe(1);
    // No further transitions after `awaiting`; the loop exited cleanly.
    expect(cap.states.map(s => s.kind)).toEqual(['creating', 'awaiting']);
  });
});
