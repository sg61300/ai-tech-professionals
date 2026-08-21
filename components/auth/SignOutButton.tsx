'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  async function signOut() {
    await createClient().auth.signOut();
    // Full nav so server components re-render in the signed-out state on first load.
    window.location.assign('/login');
  }
  return (
    <Button variant="outline" size="sm" onClick={signOut}>
      Sign out
    </Button>
  );
}
