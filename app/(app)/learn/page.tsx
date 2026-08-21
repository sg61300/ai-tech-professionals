import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display";
import { levelProgress } from "@/lib/xp";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RuneMascot } from "@/components/brand/RuneMascot";
import { RuneLoader } from "@/components/brand/RuneLoader";

/**
 * Slice 0 dashboard SHELL. Streams: the page shell paints instantly with the
 * "Rune is Tuning" loader while the profile query resolves (so post-sign-in
 * latency shows our loader, not a blank screen). Real Learn path = Slice 1.
 */
export default function LearnPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <RuneLoader size={200} />
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_name, xp, level, streak_count")
    .eq("id", user.id)
    .single();

  const name = displayName(profile ?? {});
  const xp = profile?.xp ?? 0;
  const { level, progress } = levelProgress(xp);

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet">
            Slice 0 · Dashboard shell
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Hi {name} 👋</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-4">
          <RuneMascot state="idle" spriteSrc="/mascot/rune-hero-clean.png" dimensions={84} />
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Level {level}</span>
              <span className="text-muted-foreground">
                🔥 {profile?.streak_count ?? 0} · {xp} XP
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-teal transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;re signed in and reading a real Supabase session. The learning
          path arrives in Slice 1.
        </p>
      </section>
    </>
  );
}
