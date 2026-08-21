'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { RuneMascot } from '@/components/brand/RuneMascot';
import { RuneLoader } from '@/components/brand/RuneLoader';

/**
 * Login / OTP (activation spine, Slice 0). Code flow: email -> Supabase emails a
 * 6-digit code -> user types it in THIS tab -> verifyOtp -> full-page nav to
 * /learn (so the server reads the fresh session cookie on the first request).
 * While a request is in flight we show the enlarged "Rune is Tuning" loader.
 */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
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
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    // Full-page navigation so the server sees the just-written session cookie on
    // the first request (soft router.replace raced it -> needed a 2nd click).
    // Stay busy (loader shown) through the redirect.
    window.location.assign('/learn');
  }

  async function google() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  // Enlarged loader while any auth request is in flight.
  if (busy) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-10">
        <RuneLoader size={240} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <RuneMascot state="greet" spriteSrc="/mascot/rune-hero-clean.png" dimensions={140} />
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
          <Button type="submit" className="w-full">
            Email me a code
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
          <Button type="submit" className="w-full">
            Verify &amp; continue
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

      <Button variant="outline" onClick={google} className="w-full gap-2">
        <GoogleIcon />
        Continue with Google
      </Button>

      {error && <p className="mt-4 text-center text-sm text-error">{error}</p>}
    </main>
  );
}
