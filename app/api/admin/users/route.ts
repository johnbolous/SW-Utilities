import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { parsePagination } from "@/lib/admin/pagination";
import { validateParkAssignment, applyParkAssignment } from "@/lib/admin/syncUserParkAccess";
import { isUserRole } from "@/lib/utils/enumGuards";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const roleParam = request.nextUrl.searchParams.get("role") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? ""; // 'active' | 'disabled'
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("id, username, full_name, role, is_active, must_change_password, language, theme, created_at, last_login_at, all_parks_access", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q) query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (isUserRole(roleParam)) query = query.eq("role", roleParam);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  const users = data ?? [];
  const userIds = users.map((u) => u.id);
  const { data: accessRows } = userIds.length
    ? await supabase.from("user_park_access").select("user_id, park_id").in("user_id", userIds)
    : { data: [] };

  const parksByUser = new Map<string, { park_id: string }[]>();
  for (const row of accessRows ?? []) {
    const list = parksByUser.get(row.user_id) ?? [];
    list.push({ park_id: row.park_id });
    parksByUser.set(row.user_id, list);
  }

  const usersWithParks = users.map((u) => ({ ...u, user_park_access: parksByUser.get(u.id) ?? [] }));

  return NextResponse.json({ users: usersWithParks, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const username = (body.username ?? "").trim().toLowerCase();
  const fullName = (body.fullName ?? "").trim();
  const password = body.password ?? "";

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "INVALID_USERNAME" }, { status: 400 });
  }
  if (!fullName) return NextResponse.json({ error: "MISSING_FULL_NAME" }, { status: 400 });
  if (!isPasswordStrongEnough(password)) return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });

  const roleInput = body.role ?? "technician";
  if (!isUserRole(roleInput)) {
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
  }
  const role = roleInput;

  const parkValidation = validateParkAssignment({ role, parkIds: body.parkIds, allParksAccess: body.allParksAccess });
  if (!parkValidation.ok) return NextResponse.json({ error: parkValidation.error }, { status: 400 });

  const supabase = createAdminClient();
  const passwordHash = await hashPassword(password);
  const insertRow: Database["public"]["Tables"]["users"]["Insert"] = {
    username,
    full_name: fullName,
    password_hash: passwordHash,
    role,
    created_by: admin.id,
    all_parks_access: parkValidation.allParksAccess,
  };
  const { data: user, error } = await supabase
    .from("users")
    .insert(insertRow)
    .select("id, username, full_name, role, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "USERNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await applyParkAssignment(supabase, user.id, parkValidation);

  await supabase.from("audit_log").insert({
    user_id: admin.id,
    action: "user_created",
    table_name: "users",
    record_id: user.id,
    new_value: { username, full_name: fullName, role, parkIds: parkValidation.parkIds, allParksAccess: parkValidation.allParksAccess },
  });

  return NextResponse.json({ user }, { status: 201 });
}
