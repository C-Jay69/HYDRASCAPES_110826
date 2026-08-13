import type { Metadata } from 'next';
import Link from 'next/link';
import LoginForm from '@/app/components/auth/login-form';
import { Logo } from '@/app/components/logo';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-divider">
        <nav className="mx-auto flex max-w-md items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Sign in to manage your properties, stays and payouts.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}