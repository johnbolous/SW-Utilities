import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { validateParkAssignment, applyParkAssignment } from "@/lib/admin/syncUserParkAccess";
import { isUserRole } from "@/lib/utils/enumGuards";
import type { Database } from "@/types/database";

type UserRole = string;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("users").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["users"]["Update"] = {};
  let newPasswordSet = false;
  let newRole: UserRole | undefined;

  if (typeof body.fullName === "string" && body.fullName.trim()) patch.full_name = body.fullName.trim();

  if (typeof body.role === "string") {
    if (!isUserRole(body.role)) {
      return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    newRole = body.role;
    // Guard rail: an admin can't demote themselves if they're the only admin left.
    if (before.role === "admin" && newRole !== "admin" && params.id === admin.id) {
      const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "LAST_ADMIN_CANNOT_DEMOTE_SELF" }, { status: 400 });
      }
    }
    patch.role = newRole as any;
  }

  if (typeof body.isActive === "boolean") {
    if (!body.isActive && before.role === "admin") {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "LAST_ADMIN_CANNOT_DISABLE" }, { status: 400 });
      }
    }
    patch.is_active = body.isActive;
  }

  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    if (!isPasswordStrongEnough(body.newPassword)) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    patch.password_hash = await hashPassword(body.newPassword);
    patch.must_change_password = body.forceChangeOnNextLogin !== false;
    newPasswordSet = true;
  }

  if (Object.keys(patch).length === 0 && body.parkIds === undefined && body.allParksAccess === undefined) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  const effectiveRole: UserRole = newRole ?? before.role;
  let parkValidation: ReturnType<typeof validateParkAssignment> | null = null;
  if (body.parkIds !== undefined || body.allParksAccess !== undefined || newRole) {
    parkValidation = validateParkAssignment({ role: effectiveRole as any, parkIds: body.parkIds, allParksAccess: body.allParksAccess });
    if (!parkValidation.ok) return NextResponse.json({ error: parkValidation.error }, { status: 400 });
    patch.all_parks_access = parkValidation.allParksAccess;
  }

  const { data: after, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", params.id)
    .select("id, username, full_name, role, is_active, must_change_password, created_at, last_login_at, all_parks_access")
    .single();

  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  if (parkValidation) {
    await applyParkAssignment(supabase, params.id, parkValidation);
  }

  await supabase.from("audit_log").insert({
    user_id: admin.id,
    action: newPasswordSet ? "user_password_reset" : "user_updated",
    table_name: "users",
    record_id: params.id,
    old_value: { role: before.role, is_active: before.is_active, full_name: before.full_name },
    new_value: { role: after.role, is_active: after.is_active, full_name: after.full_name },
  });

  // Disabling a user, changing their role, or resetting their password all
  // invalidate any session they're currently holding — otherwise a disabled
  // account could keep working until its cookie naturally expires.
  if (newPasswordSet || patch.is_active === false || newRole) {
    await destroyAllSessionsForUser(params.id);
  }

  return NextResponse.json({ user: after });
}
