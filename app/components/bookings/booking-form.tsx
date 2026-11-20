'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/app/lib/money';

interface Quote {
  nights: number;
  perNightRateMinor: number;
  nightlySubtotalMinor: number;
  cleaningFeeMinor: number;
  taxesMinor: number;
  totalMinor: number;
  currency: string;
}

interface BookingFormProps {
  propertyId: string;
  maxGuests: number;
  currency: string;
}

const inputClass =
  'w-full rounded-lg border border-divider bg-void px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ember-500/20';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Date selection, live quote, then booking.
 *
 * The quote is advisory: the server re-prices and re-checks availability when
 * the booking is created, and the database decides who wins a race.
 */
export default function BookingForm({ propertyId, maxGuests, currency }: BookingFormProps) {
  const router = useRouter();

  const [checkin, setCheckin] = useState(plusDays(7));
  const [checkout, setCheckout] = useState(plusDays(10));
  const [guests, setGuests] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState(false);

  async function checkAvailability() {
    setError(null);
    setUnavailable(null);
    setQuote(null);
    setChecking(true);

    try {
      const response = await fetch('/api/bookings/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, checkin, checkout, guestsCount: guests }),
      });
      const result = await response.json();

      if (!response.ok) {
        const issues = Array.isArray(result.issues)
          ? result.issues.map((i: { field: string; message: string }) => i.message).join('; ')
          : null;
        throw new Error(issues ?? result.error ?? 'Could not price those dates');
      }

      if (!result.available) {
        setUnavailable(result.unavailableReason ?? 'Those dates are not available');
        return;
      }

      setQuote(result.quote);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : 'Could not price those dates');
    } finally {
      setChecking(false);
    }
  }

  async function book() {
    setError(null);
    setBooking(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, checkin, checkout, guestsCount: guests }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=/book/${propertyId}`);
          return;
        }
        const issues = Array.isArray(result.issues)
          ? result.issues.map((i: { field: string; message: string }) => i.message).join('; ')
          : null;
        throw new Error(issues ?? result.error ?? 'Could not create the booking');
      }

      if (result.payment?.mode === 'stripe' && result.payment.checkoutUrl) {
        window.location.href = result.payment.checkoutUrl;
        return;
      }

      router.push(`/bookings/${result.booking.id}?payment=development`);
    } catch (bookError) {
      setError(bookError instanceof Error ? bookError.message : 'Could not create the booking');
      setBooking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-divider bg-card p-6">
      <h2 className="text-lg font-semibold">Check availability</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Check-in</span>
          <input
            type="date"
            min={today()}
            value={checkin}
            onChange={(event) => {
              setCheckin(event.target.value);
              setQuote(null);
            }}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Check-out</span>
          <input
            type="date"
            min={checkin}
            value={checkout}
            onChange={(event) => {
              setCheckout(event.target.value);
              setQuote(null);
            }}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-foreground-muted">Guests</span>
        <select
          value={guests}
          onChange={(event) => {
            setGuests(Number(event.target.value));
            setQuote(null);
          }}
          className={inputClass}
        >
          {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count} guest{count === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </label>

      {!quote && (
        <button
          type="button"
          onClick={checkAvailability}
          disabled={checking}
          className="mt-4 w-full rounded-lg border border-divider px-4 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Check price'}
        </button>
      )}

      {unavailable && (
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {unavailable}
        </p>
      )}

      {quote && (
        <div className="mt-4 space-y-2 border-t border-divider pt-4 text-sm">
          <div className="flex justify-between text-foreground-muted">
            <span>
              {formatCurrency(quote.perNightRateMinor, quote.currency)} × {quote.nights} night
              {quote.nights === 1 ? '' : 's'}
            </span>
            <span>{formatCurrency(quote.nightlySubtotalMinor, quote.currency)}</span>
          </div>
          {quote.cleaningFeeMinor > 0 && (
            <div className="flex justify-between text-foreground-muted">
              <span>Cleaning fee</span>
              <span>{formatCurrency(quote.cleaningFeeMinor, quote.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-divider pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="text-teal-300">{formatCurrency(quote.totalMinor, quote.currency)}</span>
          </div>

          <button
            type="button"
            onClick={book}
            disabled={booking}
            className="mt-2 w-full rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-void disabled:opacity-60"
          >
            {booking ? 'Booking…' : 'Reserve'}
          </button>
          <p className="text-xs text-foreground-faint">
            You will only be charged the total shown. Cancellation terms are applied from the
            booking policy recorded at reservation time.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
