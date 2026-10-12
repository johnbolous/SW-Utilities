import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Only ever succeeds once. Re-checks "no admin exists" server-side
 * immediately before inserting — the wizard page also checks on mount, but
 * that client-side check is just UX; this is the real guard. Not perfectly
 * race-proof against two simultaneous first-run submissions (would need a
 * DB-level single-row constraint to be airtight), but that's an extremely
 * unlikely scenario for a "set up your own new system" flow, so it's an
 * accepted tradeoff rather than an oversight.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "ADMIN_ALREADY_EXISTS" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const fullName = (body.fullName ?? "").trim();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!fullName || !username || !password) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "INVALID_USERNAME" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "PASSWORD_MISMATCH" }, { status: 400 });
  }
  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const { data: user, error } = await supabase
    .from("users")
    .insert({ username, password_hash: passwordHash, full_name: fullName, role: "admin" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "USERNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  const { token, expiresAt } = await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
  });

  const response = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
