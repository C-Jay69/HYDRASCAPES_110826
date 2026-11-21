import type { PayoutGateway } from '@/infrastructure/db/payout.gateway';
import type { ProfileGateway } from '@/infrastructure/db/profile.gateway';
import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { ConnectPort } from '@/app/lib/payments/connect';
import type { Payout } from '@/app/core/entities';
import {
  isSupportedTransferCurrency,
  needsConversion,
  payeeCurrencyFor,
} from '@/app/lib/payments/currencies';
import {
  isFullyTransferred,
  payoutIsDue,
  pendingTransfers,
  transferAmountMinor,
  transferGroup,
  transferIdempotencyKey,
  type TransferSlot,
} from '@/app/lib/payments/release';

export interface ReleasePayoutsInput {
  now?: Date;
}

export interface ReleaseSkip {
  payoutId: string;
  reason: string;
}

export interface ReleasePayoutsOutput {
  configured: boolean;
  examined: number;
  released: string[];
  skipped: ReleaseSkip[];
  /** Payouts that failed unexpectedly; the run continues past them. */
  errors: ReleaseSkip[];
  /** Payouts where Stripe will convert currency when paying out. */
  fxConversions: { payoutId: string; from: string; to: string }[];
}

/**
 * Pays owners and hosts through Stripe Connect (spec §15.1).
 *
 * Safety properties:
 *  - only payouts past `releasable_at`, never frozen or already released;
 *  - one transfer per slot, keyed `booking:<id>:<slot>`;
 *  - an uncertain attempt is reconciled by `transfer_group` before retrying,
 *    so a crashed run cannot double-pay;
 *  - a missing/unverified Connect account skips that slot and records why.
 */
export class ReleasePayoutsUseCase {
  constructor(
    private readonly payouts: PayoutGateway,
    private readonly profiles: ProfileGateway,
    private readonly connect: ConnectPort,
    private readonly bookings: BookingGateway | null = null,
  ) {}

  async execute(input: ReleasePayoutsInput = {}): Promise<ReleasePayoutsOutput> {
    const now = input.now ?? new Date();

    if (!this.connect.isConfigured()) {
      return {
        configured: false,
        examined: 0,
        released: [],
        skipped: [],
        errors: [],
        fxConversions: [],
      };
    }

    const due = (await this.payouts.listDue(now)).filter((payout) => payoutIsDue(payout, now));

    const released: string[] = [];
    const skipped: ReleaseSkip[] = [];
    const errors: ReleaseSkip[] = [];
    const fxConversions: ReleasePayoutsOutput['fxConversions'] = [];

    for (const payout of due) {
      // One bad payout (insufficient platform balance, a Stripe error) must not
      // stop every payout behind it in the queue.
      try {
        if (!isSupportedTransferCurrency(payout.currency)) {
          skipped.push({ payoutId: payout.id, reason: 'currency_unsupported' });
          await this.payouts.updateStatus(payout.id, 'releasable', {
            failure_reason: 'currency_unsupported',
          });
          continue;
        }

        const working = await this.ensureReleasable(payout, now);
        if (!working) continue;

        // Stripe converts if the payee's local currency differs; record it so
        // operators can see where FX fees will apply.
        const owner = await this.profiles.getById(working.owner_id);
        const ownerCountry =
          typeof owner?.location_json?.country === 'string'
            ? owner.location_json.country
            : null;
        if (needsConversion(working.currency, ownerCountry)) {
          const to = payeeCurrencyFor(ownerCountry);
          if (to) fxConversions.push({ payoutId: working.id, from: working.currency, to });
        }

        let blocked: string | null = null;
        let current: Payout = working;

        for (const slot of pendingTransfers(current)) {
          const result = await this.transferSlot(current, slot);
          if (result.kind === 'transferred') {
            current = result.payout;
          } else {
            blocked = result.reason;
            break;
          }
        }

        if (blocked) {
          await this.payouts.updateStatus(current.id, 'releasable', { failure_reason: blocked });
          skipped.push({ payoutId: current.id, reason: blocked });
          continue;
        }

        if (isFullyTransferred(current)) {
          await this.payouts.updateStatus(current.id, 'released', {
            released_at: new Date().toISOString(),
            failure_reason: null,
          });
          released.push(current.id);
        }
      } catch (error) {
        const reason =
          error instanceof Error ? error.message.slice(0, 200) : 'unknown release error';
        console.error(`Payout release failed for ${payout.id}:`, error);
        errors.push({ payoutId: payout.id, reason });
        // Leave it releasable so the next run retries; nothing is lost.
        await this.payouts
          .updateStatus(payout.id, 'releasable', { failure_reason: 'release_failed' })
          .catch(() => undefined);
      }
    }

    return { configured: true, examined: due.length, released, skipped, errors, fxConversions };
  }

  /** held -> releasable, once the release time has arrived. */
  private async ensureReleasable(payout: Payout, now: Date): Promise<Payout | null> {
    if (payout.status === 'releasable') return payout;
    if (!payoutIsDue(payout, now)) return null;

    const updated = await this.payouts.updateStatus(payout.id, 'releasable');
    return updated ?? null;
  }

  private async transferSlot(
    payout: Payout,
    slot: TransferSlot,
  ): Promise<{ kind: 'transferred'; payout: Payout } | { kind: 'blocked'; reason: string }> {
    const profileId = slot === 'owner' ? payout.owner_id : payout.host_id;
    if (!profileId) return { kind: 'blocked', reason: `${slot}_missing` };

    const profile = await this.profiles.getById(profileId);
    if (!profile) return { kind: 'blocked', reason: `${slot}_profile_missing` };
    if (!profile.stripe_connect_id) return { kind: 'blocked', reason: `${slot}_not_onboarded` };

    const status = await this.connect.accountStatus(profile.stripe_connect_id);
    if (!status.transfersEnabled) return { kind: 'blocked', reason: `${slot}_account_unverified` };

    // Draw from the booking's charge when we have it, so Stripe waits for
    // those funds rather than failing on the platform balance.
    const booking = this.bookings ? await this.bookings.getById(payout.booking_id) : null;
    const sourceTransaction =
      booking?.stripe_charge_id && booking.currency === payout.currency
        ? booking.stripe_charge_id
        : null;

    const group = transferGroup(payout.booking_id);

    // Reconcile before creating: a previous run may have moved money already.
    let transferId = await this.connect.findTransfer(group, slot);

    if (!transferId) {
      const created = await this.connect.createTransfer({
        accountId: profile.stripe_connect_id,
        amountMinor: transferAmountMinor(payout, slot),
        currency: payout.currency,
        idempotencyKey: transferIdempotencyKey(payout.booking_id, slot),
        transferGroup: group,
        slot,
        description: `Hydrascapes booking ${payout.booking_id} (${slot})`,
        sourceTransaction,
      });
      transferId = created.id;
    }

    const updated = await this.payouts.updateStatus(
      payout.id,
      'releasable',
      slot === 'owner'
        ? { stripe_transfer_owner_id: transferId, failure_reason: null }
        : { stripe_transfer_host_id: transferId, failure_reason: null },
    );

    if (!updated) return { kind: 'blocked', reason: 'payout_update_failed' };
    return { kind: 'transferred', payout: updated };
  }
}
