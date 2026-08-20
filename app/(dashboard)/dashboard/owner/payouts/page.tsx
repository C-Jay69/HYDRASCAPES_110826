import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function OwnerPayoutsPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const supabase = await createClient();
  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, status, owner_amount_minor, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          View your payout history.
        </p>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Recent payouts</h2>
        {payouts && payouts.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
              >
                <span className="text-sm text-foreground-muted">{payout.status}</span>
                <span className="text-sm font-semibold text-teal-300">
                  ${((payout.owner_amount_minor ?? 0) / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-faint">No payouts yet.</p>
        )}
      </section>
    </div>
  );
}