import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root entry. Routes on session (no dev content at "/"): signed-in users go to
 * the dashboard, everyone else to login. Reads cookies, so this is dynamic —
 * it is not statically prerendered, so a missing build-time env var can't crash
 * the build here. (Slice 1 may add a real marketing/splash screen for guests.)
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/learn" : "/login");
}
