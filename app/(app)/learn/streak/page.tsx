import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { civilDateInTz } from "@/lib/streak";
import { addDaysIso, assessStreakRisk, STREAK_SAVE_WINDOW_DAYS } from "@/lib/streakinsurance";
import { StreakCalendar } from "@/components/streak/StreakCalendar";
import { TabBar } from "@/components/app/TabBar";
import { reelsHasNew } from "@/lib/reels/newness";

// Always render fresh: streak/XP/saved-day data is live and personalized, and
// must reflect the latest activity (a save must show its 💎 crystal immediately),
// so never serve a cached fetch/route here.
export const dynamic = "force-dynamic";

/**
 * Streak calendar (PRD/17 · Design activation-spine §5). Opened from the topbar
 * flame on Learn home. Renders the real month history from `daily_activity`.
 * Streak-freeze tokens are deferred post-MVP (no data model yet).
 */
export default async function StreakPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // Return to wherever the calendar was opened from (Profile links with
  // ?from=profile; the topbar flame on Learn has no param → back to Learn).
  const backHref = from === "profile" ? "/profile" : "/learn";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "streak_count, longest_streak, timezone, created_at, avatar_key, onboarding_complete, xp, last_active_date",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) redirect("/onboarding");

  const tz = profile?.timezone ?? "Asia/Kolkata";
  const today = civilDateInTz(new Date(), tz);
  const joinDate = profile?.created_at
    ? civilDateInTz(new Date(profile.created_at), tz)
    : today;

  const { data: activityRows } = await supabase
    .from("daily_activity")
    .select("activity_date")
    .eq("user_id", user.id);
  const activeDates = (activityRows ?? []).map((r) => r.activity_date as string);

  // Days rescued by streak insurance: each save bridged `gap_days` days ending
  // the day before it was purchased (saved_date − 1 … saved_date − gap_days).
  const { data: saveRows } = await supabase
    .from("streak_saves")
    .select("saved_date, gap_days")
    .eq("user_id", user.id);
  const savedDates: string[] = [];
  for (const row of saveRows ?? []) {
    const sd = row.saved_date as string;
    for (let k = 1; k <= (row.gap_days as number); k++) savedDates.push(addDaysIso(sd, -k));
  }
  // Saves bought in the rolling window drive the weekly cap (Q7). Derived from
  // the rows already fetched — no extra query.
  const windowStart = addDaysIso(today, -(STREAK_SAVE_WINDOW_DAYS - 1));
  const savesInWindow = (saveRows ?? []).filter((r) => (r.saved_date as string) >= windowStart).length;

  const reelsNew = await reelsHasNew(supabase, user.id);

  // Offer to save the streak here too (not just on the dashboard) when it's in
  // the savable window — the calendar is the natural place a user checks it.
  const risk = assessStreakRisk({
    lastActiveDate: profile?.last_active_date ?? null,
    now: new Date(),
    timeZone: tz,
    currentStreak: profile?.streak_count ?? 0,
    xp: profile?.xp ?? 0,
    savesInWindow,
  });

  return (
    <div className="lh">
      <StreakCalendar
        currentStreak={profile?.streak_count ?? 0}
        bestStreak={Math.max(profile?.longest_streak ?? 0, profile?.streak_count ?? 0)}
        activeDates={activeDates}
        today={today}
        joinDate={joinDate}
        backHref={backHref}
        savedDates={savedDates}
        risk={
          risk.canSave
            ? {
                streak: risk.streak,
                missedDays: risk.missedDays,
                cost: risk.cost,
                costPct: risk.costPct,
              }
            : undefined
        }
      />
      <TabBar avatarKey={profile?.avatar_key} reelsNew={reelsNew} />
    </div>
  );
}
