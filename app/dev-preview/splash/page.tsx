"use client";

// TEMP local visual-QA harness for the splash screen (no auth).
// Delete this route + the /dev-preview allowance in lib/supabase/middleware.ts.
import { Splash } from "@/components/splash/Splash";

export default function SplashPreview() {
  return <Splash />;
}
