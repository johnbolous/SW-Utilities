import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserParkAccess, canAccessPark } from "@/lib/admin/parkAccess";
import { getTechnicianEditWindowDays, getEngineerEditWindowDays, isWithinEditWindow } from "@/lib/admin/editWindow";
import { getFacilityTodayIso } from "@/lib/utils/serverDate";
import type { SessionUser } from "@/lib/auth/session";

export type ReadingTable = "electric_readings" | "water_readings" | "kiosk_readings" | "solar_production";

const DATE_COLUMN: Record<ReadingTable, string> = {
  electric_readings: "reading_date",
  water_readings: "reading_date",
  kiosk_readings: "reading_date",
  solar_production: "production_date",
};

/** Resolves the Technology Park a given reading row belongs to, via its entity's building. Null = unassigned/no restriction. */
async function resolveReadingParkId(table: ReadingTable, row: any): Promise<string | null> {
  const supabase = createAdminClient();

  if (table === "electric_readings") {
    const { data } = await supabase.from("meters").select("building_id").eq("id", row.meter_id).maybeSingle();
    if (!data?.building_id) return null;
    const { data: b } = await supabase.from("buildings").select("technology_park_id").eq("id", data.building_id).maybeSingle();
    return b?.technology_park_id ?? null;
  }
  if (table === "solar_production") {
    const { data } = await supabase.from("solar_inverters").select("building_id").eq("id", row.inverter_id).maybeSingle();
    if (!data?.building_id) return null;
    const { data: b } = await supabase.from("buildings").select("technology_park_id").eq("id", data.building_id).maybeSingle();
    return b?.technology_park_id ?? null;
  }
  if (table === "water_readings") {
    const { data } = await supabase.from("water_meters").select("building_id").eq("id", row.water_meter_id).maybeSingle();
    if (!data?.building_id) return null;
    const { data: b } = await supabase.from("buildings").select("technology_park_id").eq("id", data.building_id).maybeSingle();
    return b?.technology_park_id ?? null;
  }
  // kiosk_readings
  const { data } = await supabase.from("kiosks").select("building_id").eq("id", row.kiosk_id).maybeSingle();
  if (!data?.building_id) return null;
  const { data: b } = await supabase.from("buildings").select("technology_park_id").eq("id", data.building_id).maybeSingle();
  return b?.technology_park_id ?? null;
}

export interface EditCheckResult {
  allowed: boolean;
  reason?: "NOT_FOUND" | "NOT_YOUR_READING" | "OUTSIDE_PARK" | "OUTSIDE_EDIT_WINDOW";
}

/**
 * The single place all "can this user edit this reading" logic lives —
 * used by both the edit endpoint (real enforcement) and the editable-list
 * endpoint (so the list only shows what's actually editable, matching what
 * the UI should also independently disable — see
 * components/reading/ReadingHistory.tsx for the frontend mirror of this).
 */
export async function checkReadingEditable(
  user: SessionUser,
  table: ReadingTable,
  row: { id: string; technician_id: string; [key: string]: any },
  preFetchedAccess?: Awaited<ReturnType<typeof getUserParkAccess>>
): Promise<EditCheckResult> {
  if (user.role === "admin") return { allowed: true };

  const parkId = await resolveReadingParkId(table, row);
  const today = getFacilityTodayIso();
  const readingDate = row[DATE_COLUMN[table]] as string;
  const access = preFetchedAccess ?? (await getUserParkAccess(user));

  if (user.role === "technician") {
    if (row.technician_id !== user.id) return { allowed: false, reason: "NOT_YOUR_READING" };
    if (!canAccessPark(access, parkId)) return { allowed: false, reason: "OUTSIDE_PARK" };
    const windowDays = await getTechnicianEditWindowDays();
    if (!isWithinEditWindow(readingDate, windowDays, today)) return { allowed: false, reason: "OUTSIDE_EDIT_WINDOW" };
    return { allowed: true };
  }

  // engineer
  if (!canAccessPark(access, parkId)) return { allowed: false, reason: "OUTSIDE_PARK" };
  const windowDays = await getEngineerEditWindowDays();
  if (!isWithinEditWindow(readingDate, windowDays, today)) return { allowed: false, reason: "OUTSIDE_EDIT_WINDOW" };
  return { allowed: true };
}

export { resolveReadingParkId, DATE_COLUMN };
