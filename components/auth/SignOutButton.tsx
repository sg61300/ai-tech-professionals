'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { editStore } from '@/lib/profile/editStore';

export function SignOutButton() {
  async function signOut() {
    // Unsaved profile edits? Route through the leave-guard popup instead.
    if (editStore.isDirty()) {
      editStore.requestLeave({ type: 'signout' });
      return;
    }
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
