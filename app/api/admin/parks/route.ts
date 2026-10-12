import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination } from "@/lib/admin/pagination";
import { logAudit } from "@/lib/admin/audit";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "engineer"]);
  if (guard instanceof NextResponse) return guard;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();
  let query = supabase.from("technology_parks").select("*", { count: "exact" }).order("sort_order");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  return NextResponse.json({ parks: data, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const code = (body.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const name = (body.name ?? "").trim();
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!code) return NextResponse.json({ error: "MISSING_CODE" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("technology_parks")
    .insert({ code, name, sort_order: sortOrder })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "CODE_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "park_created", tableName: "technology_parks", recordId: data.id, newValue: data });
  return NextResponse.json({ park: data }, { status: 201 });
}
