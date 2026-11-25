import type { AppUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type PlayerStats = {
  username: string;
  avatarUrl: string | null;
  coins: number;
  xp: number;
  level: number;
  rp: number;
  streak: number;
  bestStreak: number;
  adventureLevel: number;
  rank: number | null;
  createdAt: string | null;
  /** False when the `profiles` table could not be read (migration not applied yet). */
  ready: boolean;
};

function emptyStats(user: AppUser): PlayerStats {
  return {
    username: user.username,
    avatarUrl: null,
    coins: 0,
    xp: 0,
    level: 1,
    rp: 0,
    streak: 0,
    bestStreak: 0,
    adventureLevel: 1,
    rank: null,
    createdAt: null,
    ready: false,
  };
}

/**
 * Reads the signed-in player's stats on the server.
 * Never throws: a missing table (pending migration) or a network error simply
 * yields zeroed stats so pages keep rendering.
 */
export async function getPlayerStats(user: AppUser | null): Promise<PlayerStats> {
  if (!user) {
    return {
      ...emptyStats({ id: "", email: null, username: "Guest" }),
      ready: true,
    };
  }
  if (!isSupabaseConfigured) return emptyStats(user);

  try {
    const supabase = await createClient();
    const [profileResult, rankResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "username, avatar_url, coins, xp, level, rp, streak, best_streak, adventure_level, created_at",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("leaderboard").select("rank").eq("id", user.id).maybeSingle(),
    ]);

    if (profileResult.error || !profileResult.data) return emptyStats(user);

    const row = profileResult.data;
    return {
      username: row.username ?? user.username,
      avatarUrl: row.avatar_url ?? null,
      coins: row.coins ?? 0,
      xp: row.xp ?? 0,
      level: row.level ?? 1,
      rp: row.rp ?? 0,
      streak: row.streak ?? 0,
      bestStreak: row.best_streak ?? 0,
      adventureLevel: row.adventure_level ?? 1,
      rank: rankResult.data?.rank ?? null,
      createdAt: row.created_at ?? null,
      ready: true,
    };
  } catch {
    return emptyStats(user);
  }
}
