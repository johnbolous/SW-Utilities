import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type Supa = ReturnType<typeof createAdminClient>;

export async function logAudit(
  supabase: Supa,
  params: {
    actorId: string;
    action: string;
    tableName: string;
    recordId: string | null;
    oldValue?: Json | null;
    newValue?: Json | null;
  }
) {
  await supabase.from("audit_log").insert({
    user_id: params.actorId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
}
