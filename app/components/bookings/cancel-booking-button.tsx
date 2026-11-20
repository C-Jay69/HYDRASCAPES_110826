'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/app/lib/money';

interface CancelBookingButtonProps {
  bookingId: string;
  currency: string;
  /** Refund the policy currently entitles this cancellation to, in minor units. */
  refundPreviewMinor: number;
  /** Human explanation of the tier, shown before confirming. */
  refundPreviewReason: string;
}

export default function CancelBookingButton({
  bookingId,
  currency,
  refundPreviewMinor,
  refundPreviewReason,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    const confirmed = window.confirm(
      `Cancel this booking?\n\n${refundPreviewReason}\n\nRefund: ${formatCurrency(
        refundPreviewMinor,
        currency,
      )}`,
    );
    if (!confirmed) return;

    setWorking(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not cancel the booking');
      router.refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel');
      setWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={cancel}
        disabled={working}
        className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
      >
        {working ? 'Cancelling…' : 'Cancel booking'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
