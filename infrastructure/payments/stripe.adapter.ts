/**
 * Stripe adapter (spec §15, §16).
 *
 * Responsibilities: session/payment creation, refunds, signature verification
 * and webhook idempotency bookkeeping. No financial arithmetic lives here —
 * amounts arrive already computed in minor units by the booking modules.
 */

import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountStatus,
  ConnectPort,
  CreateTransferInput,
} from '@/app/lib/payments/connect';
import type { TransferSlot } from '@/app/lib/payments/release';

const PROVIDER = 'stripe';
const UNIQUE_VIOLATION = '23505';

export interface BeginEventInput {
  id: string;
  type: string;
  payloadHash: string;
}

export interface CheckoutSessionInput {
  bookingId: string;
  amountMinor: number;
  currency: string;
  description: string;
  guestEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds. Must be 30 minutes to 24 hours from creation. */
  expiresAt: number;
  /** Stripe Tax: compute and collect tax at checkout. */
  automaticTax?: boolean;
}

export interface StripePort {
  isConfigured: () => boolean;
  createCheckoutSession: (input: CheckoutSessionInput) => Promise<{ id: string; url: string | null }>;
  refund: (
    paymentIntentId: string,
    amountMinor: number,
    idempotencyKey: string,
  ) => Promise<{ id: string; status: string | null }>;
  verifyWebhookSignature: (
    body: string,
    signature: string,
    webhookSecret: string,
  ) => Stripe.Event;
  /** Claims the event for processing. False means a duplicate delivery. */
  beginEvent: (event: BeginEventInput) => Promise<boolean>;
  markEventProcessed: (eventId: string) => Promise<void>;
  markEventFailed: (eventId: string, errorCode: string) => Promise<void>;
}

export interface StripeAdapter extends StripePort, ConnectPort {}

export function stripeIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function createStripeAdapter(supabase: SupabaseClient): StripeAdapter {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  const stripe = new Stripe(secretKey);

  const events = () => supabase.from('processed_webhook_events');

  return {
    isConfigured: () => true,

    // ---- Connect (spec §15, §15.1) -------------------------------------

    async createAccount(input) {
      // Marketplace recipients: platform owns pricing and losses, Express
      // dashboard, and only the transfers capability — requesting card_payments
      // would force a much longer onboarding for no benefit here.
      //
      // Platform-owned loss liability must be accepted once in the Stripe
      // dashboard (Settings → Connect → Platform profile) before this works in
      // live mode.
      const account = await stripe.accounts.create({
        country: input.country,
        email: input.email,
        business_type: 'individual',
        controller: {
          stripe_dashboard: { type: 'express' },
          fees: { payer: 'application' },
          losses: { payments: 'application' },
        },
        capabilities: { transfers: { requested: true } },
      });
      return { id: account.id };
    },

    async createAccountLink(accountId, urls) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        return_url: urls.returnUrl,
        refresh_url: urls.refreshUrl,
      });
      return { url: link.url };
    },

    async createAccountSession(accountId) {
      const session = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: { enabled: true },
          // Keeps accounts compliant as requirements change, inside our UI.
          notification_banner: { enabled: true },
        },
      });
      return { clientSecret: session.client_secret };
    },

    async accountStatus(accountId): Promise<AccountStatus> {
      const account = await stripe.accounts.retrieve(accountId);
      return {
        chargesEnabled: Boolean(account.charges_enabled),
        // The marketplace guide checks the transfers capability, not the
        // account's own payout enablement.
        transfersEnabled: account.capabilities?.transfers === 'active',
      };
    },

    async findTransfer(group, slot) {
      // Reconcile an uncertain prior attempt instead of repeating it.
      const transfers = await stripe.transfers.list({ transfer_group: group, limit: 10 });
      const match = transfers.data.find(
        (transfer) => (transfer.metadata?.slot as TransferSlot | undefined) === slot,
      );
      return match?.id ?? null;
    },

    async createTransfer(input: CreateTransferInput) {
      const transfer = await stripe.transfers.create(
        {
          amount: input.amountMinor,
          currency: input.currency.toLowerCase(),
          destination: input.accountId,
          transfer_group: input.transferGroup,
          description: input.description,
          metadata: { slot: input.slot },
          ...(input.sourceTransaction ? { source_transaction: input.sourceTransaction } : {}),
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: transfer.id };
    },

    async reverseTransfer(transferId, amountMinor, idempotencyKey) {
      const reversal = await stripe.transfers.createReversal(
        transferId,
        { amount: amountMinor },
        { idempotencyKey },
      );
      return { id: reversal.id };
    },

    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountMinor,
                product_data: { name: input.description },
              },
            },
          ],
          customer_email: input.guestEmail ?? undefined,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          // Expire with the hold, so the session cannot outlive the dates.
          expires_at: input.expiresAt,
          // Bookings read better with a "Book" button than "Pay".
          submit_type: 'book',
          ...(input.automaticTax
            ? {
                automatic_tax: { enabled: true },
                billing_address_collection: 'required' as const,
              }
            : {}),
          // The booking id is the only trusted link back from the provider.
          metadata: { booking_id: input.bookingId },
          payment_intent_data: {
            metadata: { booking_id: input.bookingId },
            // Associates the charge with the transfers made for it.
            transfer_group: `booking:${input.bookingId}`,
          },
        },
        // One session per booking attempt; retries reuse the same intent key.
        { idempotencyKey: `checkout:${input.bookingId}` },
      );

      return { id: session.id, url: session.url };
    },

    async refund(paymentIntentId, amountMinor, idempotencyKey) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, amount: amountMinor },
        { idempotencyKey },
      );
      return { id: refund.id, status: refund.status ?? null };
    },

    verifyWebhookSignature(body, signature, webhookSecret) {
      return stripe.webhooks.constructEvent(body, signature, webhookSecret);
    },

    async beginEvent(event) {
      const { error } = await events().insert({
        provider: PROVIDER,
        event_id: event.id,
        event_type: event.type,
        payload_hash: event.payloadHash,
        processing_status: 'processing',
      });

      if (!error) return true;
      if (error.code === UNIQUE_VIOLATION) return false;

      throw new Error(`Failed to record webhook event ${event.id}: ${error.message}`);
    },

    async markEventProcessed(eventId) {
      const { error } = await events()
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) console.error(`Failed to mark webhook event ${eventId} processed:`, error);
    },

    async markEventFailed(eventId, errorCode) {
      const { error } = await events()
        .update({ processing_status: 'failed', error_code: errorCode.slice(0, 200) })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) console.error(`Failed to mark webhook event ${eventId} failed:`, error);
    },
  };
}
