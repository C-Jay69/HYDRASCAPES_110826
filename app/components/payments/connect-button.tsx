'use client';

import { useState } from 'react';
import { PAYEE_COUNTRIES } from '@/app/lib/payments/countries';

interface ConnectButtonProps {
  /** True when the profile already has a Connect account. */
  hasAccount: boolean;
  /** Country previously recorded on the profile, if any. */
  country?: string | null;
}

/**
 * Starts (or resumes) Stripe Connect onboarding.
 *
 * Account links expire, so this is also the "resume onboarding" button — the
 * use case only creates the account once.
 */
export default function ConnectButton({ hasAccount, country }: ConnectButtonProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(country ?? 'GB');

  async function start() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only used the first time, when the account is created.
        body: JSON.stringify({ country: selectedCountry }),
      });
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
      {!hasAccount && (
        <label className="mb-2 block text-sm">
          <span className="mb-1 block text-foreground-muted">Where are you based?</span>
          <select
            value={selectedCountry}
            onChange={(event) => setSelectedCountry(event.target.value)}
            className="w-full rounded-lg border border-divider bg-void px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ember-500/20"
          >
            {PAYEE_COUNTRIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      )}

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
