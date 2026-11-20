import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createServiceClient } from '@/app/lib/supabase/service';
import { formatCurrency, formatMinor } from '@/app/lib/money';
import { calculateRefund } from '@/app/lib/bookings/cancellation';
import { policyFromSnapshot } from '@/app/lib/bookings/policies';
import { canTransition } from '@/app/lib/bookings/state';
import CancelBookingButton from '@/app/components/bookings/cancel-booking-button';
import type { Booking, Property } from '@/app/core/entities';

export const metadata: Metadata = { title: 'Your booking' };
export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  pending_payment: 'border-warning/30 bg-warning/10 text-warning',
  reserved: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  confirmed: 'border-success/30 bg-success/10 text-success',
  checked_in: 'border-success/30 bg-success/10 text-success',
  checked_out: 'border-divider bg-surface text-foreground-muted',
  completed: 'border-divider bg-surface text-foreground-muted',
  cancelled: 'border-danger/30 bg-danger/10 text-danger',
  refunded: 'border-danger/30 bg-danger/10 text-danger',
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;

  const { user, profile } = await getUser();
  if (!user || !profile) redirect(`/login`);

  const service = createServiceClient();

  const { data: bookingRow } = await service
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const booking = bookingRow as Booking | null;
  if (!booking) notFound();

  const isGuest = booking.guest_id === user.id;
  const isHostSide = booking.owner_id === user.id || booking.host_id === user.id;
  if (!isGuest && !isHostSide && profile.role !== 'admin') notFound();

  const { data: propertyRow } = await service
    .from('properties')
    .select('id, title, currency')
    .eq('id', booking.property_id)
    .maybeSingle();
  const property = propertyRow as Pick<Property, 'id' | 'title' | 'currency'> | null;

  const policy = policyFromSnapshot(
    booking.cancellation_policy_key,
    booking.cancellation_policy_snapshot,
  );

  const paid = booking.stripe_payment_intent_id ? Number(booking.total_amount_minor) : 0;
  const refundPreview = calculateRefund({
    checkin: booking.checkin,
    paidMinor: paid,
    nightlySubtotalMinor: Number(booking.nightly_subtotal_minor),
    policy,
  });

  // The state machine already defines which statuses may be cancelled.
  const cancellable = canTransition(booking.status, 'cancelled');

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-divider bg-void">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="text-sm font-medium text-foreground-muted hover:text-foreground">
            Dashboard
          </Link>
          {property && (
            <Link
              href={`/property/${property.id}`}
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              View property
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {property?.title ?? 'Booking'}
          </h1>
          <span
            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase ${
              STATUS_STYLE[booking.status] ?? 'border-divider bg-surface text-foreground-muted'
            }`}
          >
            {booking.status.replace('_', ' ')}
          </span>
        </div>

        {payment === 'development' && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Development mode: Stripe is not configured, so this booking was confirmed without a
            payment. No money moved.
          </p>
        )}

        {payment === 'cancelled' && (
          <p className="rounded-lg border border-divider bg-card px-3 py-2 text-sm text-foreground-muted">
            Checkout was cancelled. Your dates are held only until the hold expires.
          </p>
        )}

        <section className="rounded-2xl border border-divider bg-card p-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground-faint">Check-in</dt>
              <dd>{booking.checkin}</dd>
            </div>
            <div>
              <dt className="text-foreground-faint">Check-out</dt>
              <dd>{booking.checkout}</dd>
            </div>
            <div>
              <dt className="text-foreground-faint">Nights</dt>
              <dd>{booking.nights}</dd>
            </div>
            <div>
              <dt className="text-foreground-faint">Guests</dt>
              <dd>{booking.guests_count}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-2 border-t border-divider pt-4 text-sm">
            <div className="flex justify-between text-foreground-muted">
              <span>
                {formatCurrency(Number(booking.per_night_rate_minor), booking.currency)} ×{' '}
                {booking.nights} nights
              </span>
              <span>{formatCurrency(Number(booking.nightly_subtotal_minor), booking.currency)}</span>
            </div>
            {Number(booking.cleaning_fee_minor) > 0 && (
              <div className="flex justify-between text-foreground-muted">
                <span>Cleaning fee</span>
                <span>{formatCurrency(Number(booking.cleaning_fee_minor), booking.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-divider pt-2 font-semibold">
              <span>Total</span>
              <span className="text-teal-300">
                {formatCurrency(Number(booking.total_amount_minor), booking.currency)}
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-foreground-faint">
            Cancellation policy: {policy.label} (v{booking.cancellation_policy_version}) — full
            refund until {policy.fullRefundHours / 24} days before check-in
            {policy.partialRefundHours > 0
              ? `, then ${policy.partialRefundPct}% until ${policy.partialRefundHours}h before.`
              : '.'}
          </p>
        </section>

        {booking.status === 'cancelled' && Number(booking.refund_amount_minor ?? 0) > 0 && (
          <section className="rounded-2xl border border-divider bg-card p-6 text-sm">
            <h2 className="font-semibold">Refund</h2>
            <p className="mt-1 text-foreground-muted">
              {formatMinor(Number(booking.refund_amount_minor), booking.currency)}{' '}
              {booking.currency} was refunded under the policy recorded at booking time.
            </p>
          </section>
        )}

        {cancellable && (
          <section className="rounded-2xl border border-divider bg-card p-6">
            <h2 className="mb-1 text-sm font-semibold">Cancel this booking</h2>
            <p className="mb-4 text-sm text-foreground-muted">{refundPreview.reason}</p>
            <CancelBookingButton
              bookingId={booking.id}
              currency={booking.currency}
              refundPreviewMinor={refundPreview.refundMinor}
              refundPreviewReason={refundPreview.reason}
            />
          </section>
        )}

        <p className="text-xs text-foreground-faint">
          Booking reference <code>{booking.id}</code>
        </p>
      </main>
    </div>
  );
}
