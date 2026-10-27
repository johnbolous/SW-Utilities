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
  const { data: before } = await supabase.from("kiosks").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["kiosks"]["Update"] = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) patch.sort_order = Number(body.sortOrder);
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.buildingId === "string") patch.building_id = body.buildingId || null;
  if (typeof body.parkId === "string") patch.park_id = body.parkId || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const { data: after, error } = await supabase.from("kiosks").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "kiosk_updated", tableName: "kiosks", recordId: params.id, oldValue: before, newValue: after });
  return NextResponse.json({ kiosk: after });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("kiosks").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await supabase.from("kiosks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "DELETE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "kiosk_deleted", tableName: "kiosks", recordId: params.id, oldValue: before });
  return NextResponse.json({ success: true });
}
