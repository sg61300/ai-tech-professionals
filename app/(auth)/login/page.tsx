'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { RuneMascot } from '@/components/brand/RuneMascot';

/**
 * Login / OTP (activation spine, Slice 0). Code flow: email -> Supabase emails a
 * 6-digit code -> user types it in THIS tab -> verifyOtp -> /learn. No redirect,
 * works across any device/browser. Requires custom SMTP + the Supabase
 * "Confirm signup" and "Magic Link" email templates to contain {{ .Token }}.
 * Google button is wired; works once the Google provider is configured.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep('code');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace('/learn');
    router.refresh();
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <RuneMascot state="greet" spriteSrc="/mascot/rune-hero-clean.png" dimensions={120} />
        <h1 className="mt-2 text-2xl font-extrabold">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Learn to do your real job with AI.
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@work.com"
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Enter the 6-digit code sent to{' '}
            <span className="font-medium text-foreground">{email}</span>
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-xl border bg-card px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Verifying…' : 'Verify & continue'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
            }}
            className="w-full text-center text-xs text-muted-foreground underline"
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" onClick={google} className="w-full">
        Continue with Google
      </Button>

      {error && <p className="mt-4 text-center text-sm text-error">{error}</p>}
    </main>
  );
}
