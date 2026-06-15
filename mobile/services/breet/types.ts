/**
 * Wire types for the Breet integration.
 *
 * The mobile app never talks to Breet directly — KaJota's backend
 * proxies the calls so the Breet API key stays server-side. These
 * types model the shape the backend hands back to the app.
 *
 * Supported coins (per Breet's published surface): BTC, ETH, BNB,
 * SOL, TRX, BCH, XRP, USDT, USDC, AVAX, LTC, TON, DOGE. We use a
 * `string` for `coin` rather than a union so the backend can expose
 * Breet's full list without a mobile-side rebuild.
 */

export type BreetSettlementCurrency = 'NGN' | 'USDC' | 'USDT' | 'GHS';

/** Address handed back from `POST /breet/deposit-address`. */
export interface BreetDepositAddress {
  /** Backend-side id for the address. Used to poll the deposit status. */
  id: string;
  /** Coin + network, e.g. `USDT-TRC20`, `BTC`, `USDC-ERC20`. */
  coin: string;
  /** The actual deposit address (paste-friendly hex / base58). */
  address: string;
  /** Optional QR payload — typically `coin:address?amount=X`. */
  qrCode?: string;
  /** Wall-clock ms when the address stops accepting funds. */
  expiresAt?: number;
  /** What inbound crypto auto-converts to once detected. */
  settlementCurrency: BreetSettlementCurrency;
}

/** Lifecycle of a single deposit on a generated address. */
export type BreetDepositStatus = 'pending' | 'detected' | 'settled' | 'expired';

export interface BreetDeposit {
  id: string;
  addressId: string;
  status: BreetDepositStatus;
  coin: string;
  /** Crypto amount the user sent, in the coin's smallest unit. */
  amountCrypto?: string;
  /** Settled amount in the configured settlement currency. */
  amountSettled?: string;
  settlementCurrency: BreetSettlementCurrency;
  /** Network tx hash once Breet confirms the inbound payment. */
  txHash?: string;
  createdAt: number;
  updatedAt: number;
}

/** Input to `POST /breet/deposit-address`. */
export interface CreateAddressInput {
  /**
   * Coin + network. The backend validates against Breet's supported
   * list; we keep it open so new coins don't require a mobile rebuild.
   */
  coin: string;
  /**
   * Optional expected amount. Useful for the order-payment flow
   * (Path B) where the address is single-use for a known total.
   */
  amountExpected?: string;
  /** Idempotency / correlation key (orderId, etc.). */
  reference?: string;
}
