import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * The ONLY way this codebase talks to Postgres/Storage. Uses the service
 * role key (bypasses RLS by design — see db/migrations/002_rls.sql for why).
 * Never import this from a Client Component; the `server-only` import above
 * makes Next.js throw a build error if you accidentally try.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Updates a reading row while recording who changed it and why, via the
 * `update_reading_with_reason` Postgres function (004_functions.sql), which
 * sets `app.current_user_id` / `app.edit_reason` transaction-locally so the
 * audit trigger (003_triggers.sql) can read them atomically with the edit.
 */
export async function updateReadingWithReason(params: {
  table: "electric_readings" | "water_readings" | "kiosk_readings" | "solar_production";
  id: string;
  patch: Json;
  reason: string;
  userId: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("update_reading_with_reason", {
    p_table: params.table,
    p_id: params.id,
    p_patch: params.patch,
    p_reason: params.reason,
    p_user_id: params.userId,
  });
  if (error) throw error;
  return data;
}
