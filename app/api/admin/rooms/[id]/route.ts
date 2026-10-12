import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import type { Database } from "@/types/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const admin = guard;

  const body = await request.json().catch(() => null);

  if (!body)
    return NextResponse.json(
      { error: "INVALID_BODY" },
      { status: 400 }
    );

  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!before)
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 }
    );

  const patch: Database["public"]["Tables"]["rooms"]["Update"] = {};

  if (typeof body.nameEn === "string")
    patch.name_en = body.nameEn.trim();

  if (typeof body.nameAr === "string")
    patch.name_ar = body.nameAr.trim() || null;

  if (body.sortOrder !== undefined)
    patch.sort_order = Number(body.sortOrder);

  if (body.floorId)
    patch.floor_id = body.floorId;

  if (body.buildingId)
    patch.building_id = body.buildingId;

  const { data: after, error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error)
    return NextResponse.json(
      { error: "UPDATE_FAILED", detail: error.message },
      { status: 500 }
    );

  await logAudit(supabase, {
    actorId: admin.id,
    action: "room_updated",
    tableName: "rooms",
    recordId: params.id,
    oldValue: before,
    newValue: after,
  });

  return NextResponse.json({
    room: after,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const admin = guard;

  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!before)
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 }
    );

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", params.id);

  if (error)
    return NextResponse.json(
      { error: "DELETE_FAILED", detail: error.message },
      { status: 500 }
    );

  await logAudit(supabase, {
    actorId: admin.id,
    action: "room_deleted",
    tableName: "rooms",
    recordId: params.id,
    oldValue: before,
  });

  return NextResponse.json({
    ok: true,
  });
}