import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string | null;
  username: string;
};

/**
 * Returns the signed-in user or null. Never throws: when Supabase is not
 * configured (or the session is invalid) the app renders in guest mode.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const { user } = data;
    const metadata = (user.user_metadata ?? {}) as { username?: string };
    return {
      id: user.id,
      email: user.email ?? null,
      username:
        metadata.username?.trim() ||
        user.email?.split("@")[0] ||
        "Player",
    };
  } catch {
    return null;
  }
}
