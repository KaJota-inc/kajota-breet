import type { BreetDeposit, BreetDepositAddress, CreateAddressInput } from './types';

/**
 * Pluggable HTTP client over KaJota backend's `/breet/*` proxy
 * surface. The backend talks to Breet with the secret API key —
 * the mobile side just talks to the backend.
 *
 * Defined as an interface so tests inject an in-memory stub without
 * spinning up axios / fetch.
 */
export interface BreetClient {
  /**
   * Generate a fresh deposit address. Returns the address + a QR
   * payload + the chosen settlement currency.
   */
  createDepositAddress(input: CreateAddressInput): Promise<BreetDepositAddress>;
  /**
   * Poll the deposit status. Returns `null` while the address is
   * idle (no inbound payment seen yet); returns the deposit record
   * once Breet's webhook has delivered an inbound notification and
   * the backend has recorded it.
   */
  getDeposit(addressId: string): Promise<BreetDeposit | null>;
}

export interface HttpBreetClientOptions {
  /** Backend base URL — typically `kajota-mobile-backend` on Render. */
  baseUrl: string;
  /**
   * Auth header value (the user's JWT / session token). Forwarded on
   * every request so the backend can attribute the address to the
   * right user.
   */
  authorization: string;
  /** Pluggable fetch for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

/**
 * Production `BreetClient` over the KaJota backend's REST surface.
 *
 * Wire shape (matches `kajota-mobile-backend` `hackathon/breet`):
 *   POST /breet/deposit-address  → BreetDepositAddress
 *   GET  /breet/deposit-address/:id → BreetDeposit | null
 *
 * Returns `null` from `getDeposit` when the backend says 404 — i.e.
 * the address exists but no deposit has been recorded yet. Any
 * other non-2xx propagates as a thrown Error.
 */
export class HttpBreetClient implements BreetClient {
  private readonly baseUrl: string;
  private readonly authorization: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: HttpBreetClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.authorization = options.authorization;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async createDepositAddress(input: CreateAddressInput): Promise<BreetDepositAddress> {
    const res = await this.fetcher(`${this.baseUrl}/breet/deposit-address`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: this.authorization,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`breet.createDepositAddress ${res.status}: ${text}`);
    }
    return (await res.json()) as BreetDepositAddress;
  }

  async getDeposit(addressId: string): Promise<BreetDeposit | null> {
    const res = await this.fetcher(
      `${this.baseUrl}/breet/deposit-address/${encodeURIComponent(addressId)}`,
      {
        method: 'GET',
        headers: { authorization: this.authorization },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await safeText(res);
      throw new Error(`breet.getDeposit ${res.status}: ${text}`);
    }
    return (await res.json()) as BreetDeposit;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}
