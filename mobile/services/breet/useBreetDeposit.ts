import { useEffect, useRef, useState } from 'react';

import type { BreetClient } from './client';
import type { BreetDeposit, BreetDepositAddress, CreateAddressInput } from './types';

/**
 * State machine for a single deposit attempt — what `BreetDepositModal`
 * renders off of.
 *
 *   idle → creating → awaiting → detected → settled
 *                          ↓
 *                       expired (timeout)
 *                          ↓
 *                       error (network / backend rejection)
 */
export type BreetDepositState =
  /** No address requested yet (modal just opened). */
  | { kind: 'idle' }
  /** POST /breet/deposit-address in flight. */
  | { kind: 'creating' }
  /** Address generated, waiting for the user to send crypto. */
  | { kind: 'awaiting'; address: BreetDepositAddress }
  /** Breet's webhook landed; inbound payment seen, settlement pending. */
  | { kind: 'detected'; address: BreetDepositAddress; deposit: BreetDeposit }
  /** Conversion complete; user's wallet has been credited. */
  | { kind: 'settled'; address: BreetDepositAddress; deposit: BreetDeposit }
  /** Address expired before any payment was detected. */
  | { kind: 'expired'; address: BreetDepositAddress }
  /** Anything threw — network, backend 5xx, etc. */
  | { kind: 'error'; reason: string };

/**
 * Pure async helper: create an address, then poll until the deposit
 * reaches a terminal state (settled / expired) or the abort signal
 * fires.
 *
 * Extracted from the hook so jest-node can exercise the lifecycle
 * deterministically without a renderer (same pattern as
 * `loadSealedKey`, `pollForOwnedTokenWith`, etc.).
 */
export interface RunBreetDepositDeps {
  client: BreetClient;
  /** What address shape to ask for. */
  input: CreateAddressInput;
  /** Called on every state transition. */
  onState: (state: BreetDepositState) => void;
  /** Cancellation flag — the loop checks before every fetch / sleep. */
  signal?: { cancelled: boolean };
  /** Polling cadence. Default 3s. */
  intervalMs?: number;
  /** Hard timeout. Default 30 minutes. */
  timeoutMs?: number;
  /** Injected sleep primitive (tests). Defaults to `setTimeout`. */
  delay?: (ms: number) => Promise<void>;
  /** Injected clock (tests). Defaults to `Date.now`. */
  now?: () => number;
}

export async function runBreetDeposit(deps: RunBreetDepositDeps): Promise<void> {
  const interval = deps.intervalMs ?? 3_000;
  const timeout = deps.timeoutMs ?? 30 * 60_000;
  const signal = deps.signal;
  const delay = deps.delay ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const now = deps.now ?? (() => Date.now());

  deps.onState({ kind: 'creating' });
  let address: BreetDepositAddress;
  try {
    address = await deps.client.createDepositAddress(deps.input);
  } catch (err) {
    deps.onState({
      kind: 'error',
      reason: err instanceof Error ? err.message : 'address creation failed',
    });
    return;
  }
  if (signal?.cancelled) return;

  deps.onState({ kind: 'awaiting', address });

  const deadline = now() + timeout;
  while (now() < deadline) {
    if (signal?.cancelled) return;

    let deposit: BreetDeposit | null;
    try {
      deposit = await deps.client.getDeposit(address.id);
    } catch (err) {
      // Transient backend blip — keep polling. A persistent failure
      // hits the deadline and exits as `expired`.
      // eslint-disable-next-line no-console
      console.warn(
        'breet.getDeposit failed; retrying',
        err instanceof Error ? err.message : err,
      );
      await delay(interval);
      continue;
    }

    if (deposit) {
      if (deposit.status === 'detected') {
        deps.onState({ kind: 'detected', address, deposit });
      } else if (deposit.status === 'settled') {
        deps.onState({ kind: 'settled', address, deposit });
        return;
      } else if (deposit.status === 'expired') {
        deps.onState({ kind: 'expired', address });
        return;
      }
      // 'pending' falls through to the next poll.
    }

    if (signal?.cancelled) return;
    await delay(interval);
  }

  // Deadline reached without a terminal state — surface as expired.
  if (!signal?.cancelled) deps.onState({ kind: 'expired', address });
}

/**
 * Hook wrapper. Kicks off `runBreetDeposit` when `input` becomes
 * non-null; tears down on unmount or when `input` becomes null
 * again. Exposes the current state for the modal to render.
 */
export function useBreetDeposit(
  client: BreetClient,
  input: CreateAddressInput | null,
): BreetDepositState {
  const [state, setState] = useState<BreetDepositState>({ kind: 'idle' });
  // Hold the latest setState across the async loop so React's stale-
  // closure trap doesn't bite — same trick the SSE consumer uses.
  const stateRef = useRef(setState);
  stateRef.current = setState;

  useEffect(() => {
    if (input === null) {
      setState({ kind: 'idle' });
      return;
    }
    const signal = { cancelled: false };
    void runBreetDeposit({
      client,
      input,
      onState: next => {
        if (!signal.cancelled) stateRef.current(next);
      },
      signal,
    });
    return () => {
      signal.cancelled = true;
    };
    // input identity drives the lifecycle — caller is responsible for
    // memoising it (e.g. with useMemo on the order id).
  }, [client, input]);

  return state;
}
