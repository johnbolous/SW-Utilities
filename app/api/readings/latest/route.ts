import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEntity } from "@/lib/data/entityLookup";
import { getFacilityTodayIso } from "@/lib/utils/serverDate";
import type { ReadingEntityType } from "@/types/database";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

  const entityType = request.nextUrl.searchParams.get("entityType") as ReadingEntityType | null;
  const entityId = request.nextUrl.searchParams.get("entityId");
  if (!entityType || !entityId) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  const entity = await resolveEntity(entityType, entityId);
  if (!entity) return NextResponse.json({ error: "ENTITY_NOT_FOUND" }, { status: 404 });

  const supabase = createAdminClient();
  // Bug fix: previously computed via new Date().toISOString(), which is
  // UTC — a few hours off from the facility's actual calendar date around
  // midnight Cairo time. Same helper used everywhere else now.
  const todayIso = getFacilityTodayIso();
  const monthStartIso = `${todayIso.slice(0, 7)}-01`;

  let previousValue = 0;
  let alreadyReadThisPeriod = false;

  if (entityType === "LOW" || entityType === "MEDIUM") {
    const { data: latest } = await supabase
      .from("electric_readings")
      .select("current_value, reading_date")
      .eq("meter_id", entityId)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      previousValue = Number(latest.current_value);
      alreadyReadThisPeriod =
        entity.readingFrequency === "MONTHLY" ? latest.reading_date >= monthStartIso : latest.reading_date === todayIso;
    }
  } else if (entityType === "WATER") {
    const { data: latest } = await supabase
      .from("water_readings")
      .select("current_value, reading_date")
      .eq("water_meter_id", entityId)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      previousValue = Number(latest.current_value);
      alreadyReadThisPeriod =
        entity.readingFrequency === "MONTHLY" ? latest.reading_date >= monthStartIso : latest.reading_date === todayIso;
    }
  } else if (entityType === "KIOSK") {
    const { data: latest } = await supabase
      .from("kiosk_readings")
      .select("current_value, reading_date")
      .eq("kiosk_id", entityId)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      previousValue = Number(latest.current_value);
      alreadyReadThisPeriod = latest.reading_date >= monthStartIso;
    }
  }
  // SOLAR: no previous value concept — production is logged daily, standalone.

  return NextResponse.json({
    previousValue,
    alreadyReadThisPeriod,
    readingFrequency: entity.readingFrequency,
    monthlyReadingDay: entity.monthlyReadingDay,
    meterCode: entity.meterCode,
    buildingName: entity.buildingName,
  });
}
