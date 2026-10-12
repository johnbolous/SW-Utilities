import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReadingEntityType } from "@/types/database";

export interface ResolvedEntity {
  id: string;
  entityType: ReadingEntityType;
  meterCode: string;
  buildingName: string;
  readingFrequency: "DAILY" | "MONTHLY";
  monthlyReadingDay: number | null;
}

/**
 * Single source of truth for "what is this entity, and what building does
 * it belong to" — used by both the photo watermark (needs building name +
 * meter code) and the reading-save routes (need frequency to decide
 * daily/monthly behavior). Looking this up server-side rather than trusting
 * a client-supplied buildingName/meterCode string avoids a watermark that
 * could be spoofed by a modified request body.
 *
 * Building name is fetched via a second, explicit query rather than an
 * embedded `buildings(name_en)` join — our hand-written Database type has
 * no real Relationships metadata, so Supabase's join-shape inference can't
 * reliably tell a to-one join from a to-many one here, and the two-query
 * approach avoids needing an `as any`/`unknown` cast to work around that.
 */
export async function resolveEntity(
  entityType: ReadingEntityType,
  id: string
): Promise<ResolvedEntity | null> {
  const supabase = createAdminClient();

  async function buildingNameFor(buildingId: string): Promise<string> {
    const { data } = await supabase.from("buildings").select("name_en").eq("id", buildingId).maybeSingle();
    return data?.name_en ?? "";
  }

  if (entityType === "LOW" || entityType === "MEDIUM") {
    const { data } = await supabase
      .from("meters")
      .select("id, meter_code, reading_frequency, monthly_reading_day, building_id")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      entityType,
      meterCode: data.meter_code,
      buildingName: await buildingNameFor(data.building_id),
      readingFrequency: data.reading_frequency,
      monthlyReadingDay: data.monthly_reading_day,
    };
  }

  if (entityType === "SOLAR") {
    const { data } = await supabase
      .from("solar_inverters")
      .select("id, meter_code, building_id")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      entityType,
      meterCode: data.meter_code,
      buildingName: await buildingNameFor(data.building_id),
      readingFrequency: "DAILY",
      monthlyReadingDay: null,
    };
  }

  if (entityType === "WATER") {
    const { data } = await supabase
      .from("water_meters")
      .select("id, meter_code, label_en, reading_frequency, monthly_reading_day")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      entityType,
      meterCode: data.meter_code,
      buildingName: data.label_en,
      readingFrequency: data.reading_frequency,
      monthlyReadingDay: data.monthly_reading_day,
    };
  }

  // KIOSK
  const { data } = await supabase
    .from("kiosks")
    .select("id, meter_code, name")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    entityType,
    meterCode: data.meter_code,
    buildingName: data.name,
    readingFrequency: "MONTHLY",
    monthlyReadingDay: 1,
  };
}
