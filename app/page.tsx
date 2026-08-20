import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Home, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Logo } from '@/app/components/logo';

const LANDING_IMAGE = '/LANDING_PAGE_1.jpg';

const FEATURES = [
  {
    icon: Home,
    title: 'List with intelligence',
    body: 'Upload property photos and get AI-driven condition analysis and pricing insight before you go live.',
  },
  {
    icon: Users,
    title: 'Verified co-hosts',
    body: 'Professional hosts complete identity verification and apply to manage your property transparently.',
  },
  {
    icon: ShieldCheck,
    title: 'Trusted money flows',
    body: 'Stripe Connect powers delayed, reconciled payouts that respect owner and host split agreements.',
  },
];

export default function LandingPage() {
  return (
    <div
      className="flex min-h-screen flex-col relative"
      style={{
        backgroundImage: `url(${LANDING_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <header className="border-b border-divider bg-void/50 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            The co-hosting marketplace that thinks ahead
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-muted">
            Hydrascapes connects property owners, verified professional co-hosts and
            trusted guests — with transparent pricing, protected payouts and
            every decision explained.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-6 py-3 text-base font-semibold text-void transition-opacity hover:opacity-90"
            >
              Join Hydrascapes <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-teal-500 px-6 py-3 text-base font-semibold text-teal-300 transition-colors hover:bg-teal-500/10"
            >
              Explore the platform
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-divider bg-card p-6"
              >
                <feature.icon className="h-8 w-8 text-ember-500" />
                <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-divider">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-foreground-faint">
          <span>© 2026 Hydrascapes</span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-gold-500" />
            Warm Amber × Electric Teal
          </span>
        </div>
      </footer>
    </div>
  );
}