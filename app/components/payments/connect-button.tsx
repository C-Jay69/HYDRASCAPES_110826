'use client';

import { useState } from 'react';

interface ConnectButtonProps {
  /** True when the profile already has a Connect account. */
  hasAccount: boolean;
}

/**
 * Starts (or resumes) Stripe Connect onboarding.
 *
 * Account links expire, so this is also the "resume onboarding" button — the
 * use case only creates the account once.
 */
export default function ConnectButton({ hasAccount }: ConnectButtonProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch('/api/connect/onboard', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not start onboarding');
      window.location.href = result.url;
    } catch (onboardError) {
      setError(onboardError instanceof Error ? onboardError.message : 'Could not start onboarding');
      setWorking(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={working}
        className="rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void disabled:opacity-60"
      >
        {working ? 'Opening Stripe…' : hasAccount ? 'Resume payout setup' : 'Set up payouts'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
