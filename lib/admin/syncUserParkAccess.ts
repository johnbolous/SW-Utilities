import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Supa = ReturnType<typeof createAdminClient>;

export interface ParkAssignmentInput {
  role: "admin" | "engineer" | "technician";
  parkIds?: string[];
  allParksAccess?: boolean;
}

export interface ParkAssignmentValidation {
  ok: boolean;
  error?: string;
  allParksAccess: boolean;
  parkIds: string[];
}

/**
 * Enforces: admin needs no assignment at all (always full access via role
 * alone); engineer may have zero-or-more specific parks OR the "all parks"
 * flag; technician must have exactly one park and never the "all parks"
 * flag. This is deliberately re-validated here (not just in the UI) since
 * the UI's job is convenience, not enforcement.
 */
export function validateParkAssignment(input: ParkAssignmentInput): ParkAssignmentValidation {
  const parkIds = Array.from(new Set(input.parkIds ?? []));
  const allParksAccess = !!input.allParksAccess;

  if (input.role === "admin") {
    return { ok: true, allParksAccess: false, parkIds: [] };
  }

  if (input.role === "engineer") {
    if (allParksAccess) return { ok: true, allParksAccess: true, parkIds: [] };
    if (parkIds.length === 0) return { ok: false, error: "ENGINEER_NEEDS_AT_LEAST_ONE_PARK", allParksAccess: false, parkIds: [] };
    return { ok: true, allParksAccess: false, parkIds };
  }

  // technician
  if (allParksAccess) return { ok: false, error: "TECHNICIAN_CANNOT_HAVE_ALL_PARKS", allParksAccess: false, parkIds: [] };
  if (parkIds.length !== 1) return { ok: false, error: "TECHNICIAN_NEEDS_EXACTLY_ONE_PARK", allParksAccess: false, parkIds: [] };
  return { ok: true, allParksAccess: false, parkIds };
}

/** Replaces all of a user's park-access rows with the given set (simple, correct at this scale). */
export async function applyParkAssignment(supabase: Supa, userId: string, validated: ParkAssignmentValidation) {
  await supabase.from("users").update({ all_parks_access: validated.allParksAccess }).eq("id", userId);
  await supabase.from("user_park_access").delete().eq("user_id", userId);
  if (validated.parkIds.length > 0) {
    await supabase.from("user_park_access").insert(validated.parkIds.map((parkId) => ({ user_id: userId, park_id: parkId })));
  }
}
