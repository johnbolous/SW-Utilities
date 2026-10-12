import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export const SESSION_COOKIE_NAME = "swup_session";
const SESSION_TTL_DAYS = 7;
const RENEW_AFTER_MINUTES = 15;

// Uses the standard Web Crypto API (globalThis.crypto) rather than
// node:crypto so this file works unmodified in both the Node.js route
// handlers and the Edge middleware.

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]!));
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

export interface SessionUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  language: "en" | "ar";
  theme: "dark" | "light";
  must_change_password: boolean;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const supabase = createAdminClient();
  const { error } = await supabase.from("sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    user_agent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });
  if (error) throw error;

  return { token, expiresAt };
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, expires_at, last_seen_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from("sessions").delete().eq("id", session.id);
    return null;
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, username, full_name, role, is_active, language, theme, must_change_password")
    .eq("id", session.user_id)
    .maybeSingle();

  if (!user || !user.is_active) return null;

  const minutesSinceSeen = (Date.now() - new Date(session.last_seen_at).getTime()) / 60000;
  if (minutesSinceSeen > RENEW_AFTER_MINUTES) {
    // Bug fix: this used to be fire-and-forget (not awaited) to save
    // latency. But both Edge middleware and Node serverless functions are
    // free to terminate the execution context as soon as the response is
    // sent, with no guarantee an un-awaited promise finishes — so renewals
    // could silently and unpredictably never happen. It's one small-row
    // UPDATE, at most once per 15 minutes per session; the correctness is
    // worth the negligible latency.
    const newExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("sessions")
      .update({ last_seen_at: new Date().toISOString(), expires_at: newExpiry })
      .eq("id", session.id);
  }

  return user as SessionUser;
}

export async function destroySessionToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();
  await supabase.from("sessions").delete().eq("token_hash", tokenHash);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("sessions").delete().eq("user_id", userId);
}
