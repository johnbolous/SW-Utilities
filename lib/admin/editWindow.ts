import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (data?.value === undefined || data?.value === null) return fallback;
  const n = Number(data.value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getTechnicianEditWindowDays(): Promise<number> {
  return getSettingNumber("technician_edit_window_days", 0);
}

export async function getEngineerEditWindowDays(): Promise<number> {
  return getSettingNumber("engineer_edit_window_days", 3);
}

/** True if `readingDate` (YYYY-MM-DD) is still within `windowDays` of today, inclusive. windowDays=0 means "today only". */
export function isWithinEditWindow(readingDate: string, windowDays: number, todayIso: string): boolean {
  const reading = new Date(readingDate + "T00:00:00Z").getTime();
  const today = new Date(todayIso + "T00:00:00Z").getTime();
  const diffDays = Math.round((today - reading) / 86400000);
  return diffDays >= 0 && diffDays <= windowDays;
}
