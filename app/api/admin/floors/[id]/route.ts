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
  const { data: before } = await supabase.from("floors").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["floors"]["Update"] = {};
  if (typeof body.nameEn === "string" && body.nameEn.trim()) patch.name_en = body.nameEn.trim();
  if (typeof body.nameAr === "string") patch.name_ar = body.nameAr.trim() || null;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) patch.sort_order = Number(body.sortOrder);

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const { data: after, error } = await supabase.from("floors").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, { actorId: admin.id, action: "floor_updated", tableName: "floors", recordId: params.id, oldValue: before, newValue: after });
  return NextResponse.json({ floor: after });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("floors").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await supabase.from("floors").delete().eq("id", params.id);
  if (error) {
    // FK violation (23503) means meters still reference this floor — the
    // schema deliberately has no ON DELETE CASCADE here, so history can
    // never be silently lost by deleting a floor out from under it.
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "FLOOR_IN_USE", detail: "This floor has meters assigned to it. Reassign or disable those meters first." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "DELETE_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "floor_deleted", tableName: "floors", recordId: params.id, oldValue: before });
  return NextResponse.json({ ok: true });
}
