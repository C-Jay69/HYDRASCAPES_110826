'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { GoogleIcon } from '@/app/components/icons/google';
import type { UserRole } from '@/app/lib/types';

const ROLE_OPTIONS: { value: Exclude<UserRole, 'admin'>; label: string; body: string }[] = [
  { value: 'owner', label: 'Property owner', body: 'List properties and manage co-hosts' },
  { value: 'host', label: 'Co-host', body: 'Get verified and manage stays' },
  { value: 'guest', label: 'Guest', body: 'Search, book and pay securely' },
];

export default function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('guest');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleSignUp() {
    setError(null);
    setOauthLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        queryParams: {
          // role is encoded in metadata; the DB trigger handles default role
          // Users signing up via OAuth get role 'guest' by default (safe default)
        },
      },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const createRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName.trim(), role }),
    });

    const createResult = await createRes.json();
    if (createRes.status !== 200 || createResult.error) {
      setLoading(false);
      setError(createResult.error || 'Unable to create account');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={oauthLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-divider bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
      >
        <GoogleIcon className="h-4 w-4" />
        {oauthLoading ? 'Redirecting…' : 'Sign up with Google'}
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-divider"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-foreground-muted">Or continue with</span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">I am a…</legend>
        <div className="grid gap-2">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                role === option.value
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-divider bg-card hover:border-teal-500/50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="mt-1 h-4 w-4 accent-teal-500"
              />
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-foreground-muted">{option.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="full-name" className="mb-1.5 block text-sm font-medium">
          Full name
        </label>
        <input
          id="full-name"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-divider bg-card px-3.5 py-2.5 text-sm placeholder:text-foreground-faint focus:border-teal-500 focus:outline-none"
          placeholder="Ada Lovelace"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-divider bg-card px-3.5 py-2.5 text-sm placeholder:text-foreground-faint focus:border-teal-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-divider bg-card px-3.5 py-2.5 text-sm placeholder:text-foreground-faint focus:border-teal-500 focus:outline-none"
          placeholder="At least 8 characters"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-foreground-muted">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-teal-300 hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}