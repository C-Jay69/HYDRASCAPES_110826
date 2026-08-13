import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/app/lib/types';

const NAV: Record<string, { href: string; label: string }[]> = {
  owner: [
    { href: '/dashboard/owner', label: 'Overview' },
    { href: '/dashboard/owner/properties', label: 'Properties' },
    { href: '/dashboard/owner/bookings', label: 'Bookings' },
    { href: '/dashboard/owner/payouts', label: 'Payouts' },
  ],
  host: [
    { href: '/dashboard/host', label: 'Overview' },
    { href: '/dashboard/host/applications', label: 'Applications' },
    { href: '/dashboard/host/stays', label: 'Stays' },
  ],
  guest: [
    { href: '/dashboard/guest', label: 'Overview' },
    { href: '/dashboard/guest/bookings', label: 'Bookings' },
  ],
  admin: [
    { href: '/dashboard/admin', label: 'Overview' },
    { href: '/dashboard/admin/moderation', label: 'Moderation' },
    { href: '/dashboard/admin/payments', label: 'Payments' },
  ],
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getUser();

  if (!user || !profile) {
    redirect('/login');
  }

  const role: UserRole = profile.role ?? 'guest';
  const navItems = NAV[role] ?? NAV.guest;

  async function handleSignOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-divider bg-void">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-ember-500 to-teal-500 text-xs font-bold text-void">
                N
              </span>
              <span className="text-base font-semibold">Nest</span>
            </Link>
            <div className="hidden gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-foreground-muted sm:block">
              {profile.full_name}
            </span>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}