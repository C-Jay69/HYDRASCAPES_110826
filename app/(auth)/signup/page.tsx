import type { Metadata } from 'next';
import Link from 'next/link';
import SignupForm from '@/app/components/auth/signup-form';
import { Logo } from '@/app/components/logo';

export const metadata: Metadata = {
  title: 'Create your account',
};

export default function SignupPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Choose how you will use Hydrascapes. You can complete verification later.
        </p>
        <SignupForm />
      </main>
    </div>
  );
}