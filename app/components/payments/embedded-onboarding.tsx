'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js';

interface EmbeddedOnboardingProps {
  publishableKey: string;
}

/**
 * Stripe Connect embedded onboarding (plan review #11).
 *
 * Runs inside our own UI instead of redirecting to Stripe. On exit we refresh
 * so the payouts page can show the account's current capability status — the
 * exit callback only means the user left the component, not that they finished.
 */
export default function EmbeddedOnboarding({ publishableKey }: EmbeddedOnboardingProps) {
  const router = useRouter();
  const [exited, setExited] = useState(false);

  const connectInstance = useMemo(
    () =>
      loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          const response = await fetch('/api/connect/account-session', { method: 'POST' });
          const result = await response.json();
          if (!response.ok || !result.clientSecret) {
            throw new Error(result.error ?? 'Could not start onboarding');
          }
          return result.clientSecret as string;
        },
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#14b8a6',
            colorBackground: '#1c242f',
            colorText: '#f5f7fa',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      }),
    [publishableKey],
  );

  return (
    <div className="rounded-xl border border-divider bg-surface p-4">
      {exited && (
        <p className="mb-3 text-sm text-foreground-muted">
          Onboarding closed. If you still have requirements to complete, reopen it below.
        </p>
      )}
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={() => {
            setExited(true);
            router.refresh();
          }}
        />
      </ConnectComponentsProvider>
    </div>
  );
}
