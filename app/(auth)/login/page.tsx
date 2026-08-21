'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { RuneMascot } from '@/components/brand/RuneMascot';

/**
 * Login (activation spine, Slice 0). Magic-link flow using Supabase's DEFAULT
 * email (no custom SMTP, no template edit): email -> Supabase emails a sign-in
 * link -> click -> /auth/callback exchanges the PKCE code -> /learn.
 * REQUIRES the redirect target to be allow-listed in Supabase -> Auth -> URL
 * Configuration (Site URL + Redirect URLs), else Supabase bounces to Site URL.
 * NOTE: open the link in the SAME browser you requested it from (PKCE verifier).
 * Google button is wired; works once the Google provider is configured.
 */
export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
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

      {sent ? (
        <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
          <p className="text-sm">
            Check <span className="font-semibold text-foreground">{email}</span> for a
            sign-in link, and open it in <span className="font-semibold">this same browser</span>.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 text-xs text-muted-foreground underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
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
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </Button>
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
