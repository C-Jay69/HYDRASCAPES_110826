import { createClient } from '@/app/lib/supabase/server';
import { requireDashboardRole } from '@/app/lib/dashboard-auth';
import { formatCurrency } from '@/app/lib/money';
import ConnectButton from '@/app/components/payments/connect-button';
import type { Payout } from '@/app/core/entities';

const STATUS_STYLE: Record<string, string> = {
  held: 'text-foreground-muted',
  releasable: 'text-teal-300',
  released: 'text-success',
  failed: 'text-danger',
  frozen: 'text-warning',
};

export default async function OwnerPayoutsPage() {
  const { user, profile } = await requireDashboardRole(['owner', 'admin']);

  const supabase = await createClient();
  const { data } = await supabase
    .from('payouts')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const payouts = (data as Payout[] | null) ?? [];
  const hasAccount = Boolean(profile.stripe_connect_id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Earnings are held until after checkout, then paid to your connected account.
        </p>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Payout account</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {hasAccount
                ? 'A Stripe account is linked. Finish any outstanding requirements to receive transfers.'
                : 'Connect a Stripe account so released payouts can be transferred to you.'}
            </p>
          </div>
          <ConnectButton hasAccount={hasAccount} />
        </div>
      </section>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Recent payouts</h2>
        {payouts.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-divider bg-surface px-4 py-3"
              >
                <div>
                  <p className={`text-sm font-medium ${STATUS_STYLE[payout.status] ?? ''}`}>
                    {payout.status}
                  </p>
                  <p className="text-xs text-foreground-faint">
                    release due {new Date(payout.releasable_at).toISOString().slice(0, 10)}
                    {payout.failure_reason ? ` · ${payout.failure_reason.replaceAll('_', ' ')}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-teal-300">
                    {formatCurrency(Number(payout.owner_amount_minor), payout.currency)}
                  </p>
                  {payout.host_amount_minor > 0 && (
                    <p className="text-xs text-foreground-faint">
                      host share{' '}
                      {formatCurrency(Number(payout.host_amount_minor), payout.currency)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-faint">
            No payouts yet. They appear here once a booking is paid.
          </p>
        )}
      </section>
    </div>
  );
}
