import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type CategoryStat = { questionCount: number; bossCount: number };

export type BoardRow = {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rp: number;
  rank: number;
};

export type DailyInfo = {
  date: string;
  categoryId: string | null;
  questionCount: number;
  xpBonus: number;
  coinBonus: number;
  /** The signed-in player's result for today, if any. */
  result: { score: number; total: number; completedAt: string } | null;
  ready: boolean;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Question counts per category. Empty map when the migration is missing. */
export async function getCategoryStats(): Promise<Record<string, CategoryStat>> {
  if (!isSupabaseConfigured) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("category_stats")
      .select("category_id, question_count, boss_count");
    if (error || !data) return {};
    const stats: Record<string, CategoryStat> = {};
    for (const row of data) {
      const id = String(row.category_id);
      stats[id] = {
        questionCount: Number(row.question_count ?? 0),
        bossCount: Number(row.boss_count ?? 0),
      };
    }
    return stats;
  } catch {
    return {};
  }
}

/** Top of the public leaderboard. */
export async function getLeaderboard(limit = 50): Promise<BoardRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leaderboard")
      .select("id, username, avatar_url, level, xp, rp, rank")
      .order("rank", { ascending: true })
      .limit(limit);
    if (error || !data) return null;
    return data.map((row) => ({
      id: String(row.id),
      username: String(row.username ?? "Player"),
      avatarUrl: (row.avatar_url as string | null) ?? null,
      level: Number(row.level ?? 1),
      xp: Number(row.xp ?? 0),
      rp: Number(row.rp ?? 0),
      rank: Number(row.rank ?? 0),
    }));
  } catch {
    return null;
  }
}

/** Today's daily challenge and the player's own result. */
export async function getDailyInfo(userId: string | null): Promise<DailyInfo> {
  const fallback: DailyInfo = {
    date: today(),
    categoryId: null,
    questionCount: 10,
    xpBonus: 100,
    coinBonus: 40,
    result: null,
    ready: false,
  };
  if (!isSupabaseConfigured) return fallback;

  try {
    const supabase = await createClient();
    const { data: challenge } = await supabase
      .from("daily_challenges")
      .select("challenge_date, category_id, question_count, xp_bonus, coin_bonus")
      .eq("challenge_date", fallback.date)
      .maybeSingle();

    let result: DailyInfo["result"] = null;
    if (userId) {
      const { data: row } = await supabase
        .from("daily_results")
        .select("score, total, completed_at")
        .eq("user_id", userId)
        .eq("challenge_date", fallback.date)
        .maybeSingle();
      if (row) {
        result = {
          score: Number(row.score ?? 0),
          total: Number(row.total ?? 0),
          completedAt: String(row.completed_at ?? ""),
        };
      }
    }

    return {
      ...fallback,
      categoryId: (challenge?.category_id as string | null) ?? null,
      questionCount: Number(challenge?.question_count ?? fallback.questionCount),
      xpBonus: Number(challenge?.xp_bonus ?? fallback.xpBonus),
      coinBonus: Number(challenge?.coin_bonus ?? fallback.coinBonus),
      result,
      ready: Boolean(challenge) || Boolean(result),
    };
  } catch {
    return fallback;
  }
}
