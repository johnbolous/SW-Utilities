import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/types/database";

/**
 * Returns the signed-in user if they have one of the allowed roles,
 * otherwise returns a NextResponse to send back immediately. Usage:
 *
 *   const guard = await requireRole(["admin"]);
 *   if (guard instanceof NextResponse) return guard;
 *   const user = guard; // typed as SessionUser from here on
 */
export async function requireRole(allowed: UserRole[]): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });
  if (!allowed.includes(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return user;
}
