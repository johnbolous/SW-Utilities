import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";

export interface ParkAccess {
  allParks: boolean;
  parkIds: string[]; // ignored when allParks is true
}

/**
 * Admin: always all parks.
 * Engineer: all_parks_access flag, or the specific parks in user_park_access.
 * Technician: exactly one park (still read from user_park_access — the "one
 * park only" rule is enforced when an admin assigns access, not by a
 * different code path here).
 */
export async function getUserParkAccess(user: SessionUser): Promise<ParkAccess> {
  if (user.role === "admin") return { allParks: true, parkIds: [] };

  const supabase = createAdminClient();
  const { data: userRow } = await supabase.from("users").select("all_parks_access").eq("id", user.id).maybeSingle();
  if (userRow?.all_parks_access) return { allParks: true, parkIds: [] };

  const { data: rows } = await supabase.from("user_park_access").select("park_id").eq("user_id", user.id);
  return { allParks: false, parkIds: (rows ?? []).map((r) => r.park_id) };
}

export function canAccessPark(access: ParkAccess, parkId: string | null): boolean {
  if (access.allParks) return true;
  if (parkId === null) return true; // unassigned/legacy building — visible to everyone until an admin assigns it a park
  return access.parkIds.includes(parkId);
}

/**
 * Building IDs the user may see, or null meaning "no restriction" (admin,
 * or an engineer/technician with all_parks_access). Used to filter
 * buildings/meters/floors queries down to the caller's assigned parks.
 */
export async function getAccessibleBuildingIds(user: SessionUser): Promise<string[] | null> {
  const access = await getUserParkAccess(user);
  if (access.allParks) return null;

  // إذا لم يكن للمستخدم أي مناطق مخصصة وليس لديه allParksAccess
  if (!access.parkIds.length) {
    // جلب المباني غير المخصصة لأي منطقة فقط (legacy/unassigned)
    const supabase = createAdminClient();
    const { data } = await supabase.from("buildings").select("id").is("technology_park_id", null);
    return (data ?? []).map((b) => b.id);
  }

  const supabase = createAdminClient();
  
  // الاستعلام الصحيح والآمن بدون أخطاء الـ Syntax في الـ Strings
  const formattedParkIds = access.parkIds.map((id) => `"${id}"`).join(",");
  const { data, error } = await supabase
    .from("buildings")
    .select("id")
    .or(`technology_park_id.in.(${formattedParkIds}),technology_park_id.is.null`);

  if (error) {
    console.error("Error fetching accessible building IDs:", error);
    return [];
  }

  return (data ?? []).map((b) => b.id);
}