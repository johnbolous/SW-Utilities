import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import { isReadingFrequency } from "@/lib/utils/enumGuards";
import type { Database } from "@/types/database";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("water_meters").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["water_meters"]["Update"] = {};
  if (typeof body.labelEn === "string" && body.labelEn.trim()) patch.label_en = body.labelEn.trim();
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.technologyParkId === "string") patch.technology_park_id = body.technologyParkId || null;
  if (typeof body.type === "string" && body.type.trim()) patch.type = body.type.trim();
  if (isReadingFrequency(body.readingFrequency)) {
    patch.reading_frequency = body.readingFrequency;
    patch.monthly_reading_day = body.readingFrequency === "MONTHLY" ? Number(body.monthlyReadingDay) || 1 : null;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const { data: after, error } = await supabase.from("water_meters").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "water_meter_updated", tableName: "water_meters", recordId: id, oldValue: before, newValue: after });
  return NextResponse.json({ waterMeter: after });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("water_meters").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await supabase.from("water_meters").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "DELETE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "water_meter_deleted", tableName: "water_meters", recordId: id, oldValue: before });
  return NextResponse.json({ success: true });
}