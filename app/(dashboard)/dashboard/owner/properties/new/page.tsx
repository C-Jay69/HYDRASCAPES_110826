import { requireDashboardRole } from '@/app/lib/dashboard-auth';
import PropertyForm from '@/app/components/properties/property-form';

export const metadata = { title: 'List a property' };

/**
 * Server component: authorization and identity happen here, then the
 * interactive form is handed to the client. Server modules (`next/headers`,
 * the cookie-bound Supabase client) must never be imported by the form.
 */
export default async function NewPropertyPage() {
  await requireDashboardRole(['owner', 'admin']);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="rounded-2xl border border-divider bg-card p-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">List a new property</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          Saved as a draft. Vision analysis runs in the background once photos are attached and
          never blocks publishing.
        </p>
        <PropertyForm />
      </div>
    </div>
  );
}
