import type { PayoutGateway } from '@/infrastructure/db/payout.gateway';
import type { ProfileGateway } from '@/infrastructure/db/profile.gateway';
import type { ConnectPort } from '@/app/lib/payments/connect';
import type { Payout } from '@/app/core/entities';
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
  ) {}

  async execute(input: ReleasePayoutsInput = {}): Promise<ReleasePayoutsOutput> {
    const now = input.now ?? new Date();

    if (!this.connect.isConfigured()) {
      return { configured: false, examined: 0, released: [], skipped: [] };
    }

    const due = (await this.payouts.listDue(now)).filter((payout) => payoutIsDue(payout, now));

    const released: string[] = [];
    const skipped: ReleaseSkip[] = [];

    for (const payout of due) {
      const working = await this.ensureReleasable(payout, now);
      if (!working) continue;

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
    }

    return { configured: true, examined: due.length, released, skipped };
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
    if (!status.payoutsEnabled) return { kind: 'blocked', reason: `${slot}_account_unverified` };

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
