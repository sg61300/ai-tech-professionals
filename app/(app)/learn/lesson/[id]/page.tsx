import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLesson, L1_SPINE } from "@/content";
import { isUnlocked } from "@/lib/progression";
import { flavorFor } from "@/lib/flavor";
import { LessonRunner } from "@/components/lesson/LessonRunner";

/**
 * Lesson route. Server-gates access: must be signed in, onboarded, and the
 * lesson must actually be unlocked for this user (no deep-linking a locked
 * lesson). The interactive flow itself is the LessonRunner island.
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lesson = getLesson(id);
  if (!lesson) redirect("/learn");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, seniority")
    .eq("id", user.id)
    .single();
  if (!profile?.onboarding_complete) redirect("/onboarding");

  // Seniority only flavors examples (settled decision): pick this learner's
  // per-level example line, if the lesson authored one for their level.
  const flavorNote = flavorFor(lesson.flavor, profile.seniority);

  // Enforce unlock order server-side.
  const { data: rows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("user_id", user.id)
    .eq("status", "done");
  const completed = new Set((rows ?? []).map((r) => r.lesson_id));

  const node = L1_SPINE.find((n) => n.id === id);
  if (node && !isUnlocked(node, completed)) redirect("/learn");

  return <LessonRunner lesson={lesson} flavorNote={flavorNote} />;
}
