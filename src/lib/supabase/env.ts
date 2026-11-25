const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the public Supabase credentials are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export function getSupabaseEnv() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    );
  }
  return { url, anonKey };
}
