import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Splash } from "@/components/splash/Splash";

/**
 * Root entry (first screen on app open). Signed-in users go straight to the
 * dashboard; guests get the splash (brand + value prop + one CTA into login).
 * Reads cookies, so this is dynamic — never statically prerendered.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/learn");
  return <Splash />;
}
