/**
 * Connect port consumed by core use cases.
 *
 * Implemented by the Stripe adapter; declared here so `core` never imports a
 * vendor SDK.
 */

import type { TransferSlot } from '@/app/lib/payments/release';

export interface AccountStatus {
  chargesEnabled: boolean;
  /** Marketplace recipients receive transfers; this is the capability that matters. */
  transfersEnabled: boolean;
}

export interface CreateTransferInput {
  accountId: string;
  amountMinor: number;
  currency: string;
  /** `booking:<id>:<slot>` — also used as the Stripe idempotency key. */
  idempotencyKey: string;
  /** `booking:<id>` — lets an uncertain attempt be reconciled, not repeated. */
  transferGroup: string;
  slot: TransferSlot;
  description: string;
}

export interface ConnectPort {
  isConfigured: () => boolean;
  createAccount: (input: { email: string; country: string }) => Promise<{ id: string }>;
  createAccountLink: (
    accountId: string,
    urls: { returnUrl: string; refreshUrl: string },
  ) => Promise<{ url: string }>;
  accountStatus: (accountId: string) => Promise<AccountStatus>;
  /** Existing transfer for this slot, if a previous attempt already moved money. */
  findTransfer: (transferGroup: string, slot: TransferSlot) => Promise<string | null>;
  createTransfer: (input: CreateTransferInput) => Promise<{ id: string }>;
  /** Claws funds back from a connected account after a post-release refund. */
  reverseTransfer: (
    transferId: string,
    amountMinor: number,
    idempotencyKey: string,
  ) => Promise<{ id: string }>;
}
