import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import type { Database } from "@/types/database";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("solar_inverters").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["solar_inverters"]["Update"] = {};
  if (typeof body.labelEn === "string" && body.labelEn.trim()) patch.label_en = body.labelEn.trim();
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const { data: after, error } = await supabase.from("solar_inverters").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "solar_inverter_updated", tableName: "solar_inverters", recordId: params.id, oldValue: before, newValue: after });
  return NextResponse.json({ solarInverter: after });
}
