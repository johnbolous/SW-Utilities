import "server-only";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionUser } from "@/lib/auth/session";

/**
 * Server Component / Route Handler helper: returns the signed-in user, or
 * null. Middleware.ts already blocks unauthorized navigation to protected
 * routes, but pages re-check anyway (defense in depth) and this is also how
 * pages read the user's name/role/preferences to render with.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
