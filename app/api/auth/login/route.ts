import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Known limitation, flagged rather than silently skipped: this route has no
// rate limiting yet. For a Vercel serverless deployment that needs a shared
// store (e.g. Upstash Redis) since in-memory counters don't persist across
// invocations/instances — worth adding before this is exposed outside a
// trusted network. Not implemented in Phase 1.

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const password = body.password;
  if (!username || !password) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, username, password_hash, full_name, role, is_active, language, theme, must_change_password")
    .ilike("username", username)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  if (!user.is_active) {
    return NextResponse.json({ error: "ACCOUNT_DISABLED" }, { status: 403 });
  }

  const { token, expiresAt } = await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
  });

  await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      language: user.language,
      theme: user.theme,
      must_change_password: user.must_change_password,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}
