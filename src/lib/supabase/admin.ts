import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/** True when the service role key is present (admin jobs available). */
export const isSupabaseAdminConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
);

/**
 * Service-role client for trusted server-only work (reward ledgers, AI jobs,
 * admin review). Never import this from a Client Component.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() est réservé au serveur.");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante : impossible d'utiliser le client administrateur.",
    );
  }

  const { url } = getSupabaseEnv();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
