import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { civilDateInTz } from "@/lib/streak";
import { StreakCalendar } from "@/components/streak/StreakCalendar";
import { TabBar } from "@/components/app/TabBar";

/**
 * Streak calendar (PRD/17 · Design activation-spine §5). Opened from the topbar
 * flame on Learn home. Renders the real month history from `daily_activity`.
 * Streak-freeze tokens are deferred post-MVP (no data model yet).
 */
export default async function StreakPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_count, longest_streak, timezone, created_at, avatar_key, onboarding_complete")
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

  return (
    <div className="lh">
      <StreakCalendar
        currentStreak={profile?.streak_count ?? 0}
        bestStreak={Math.max(profile?.longest_streak ?? 0, profile?.streak_count ?? 0)}
        activeDates={activeDates}
        today={today}
        joinDate={joinDate}
      />
      <TabBar avatarKey={profile?.avatar_key} />
    </div>
  );
}
