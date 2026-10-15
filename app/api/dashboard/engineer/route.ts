import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const TZ = "Africa/Cairo";

function cairoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateOf(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

function consumption(row: any) {
  if (row?.consumption !== null && row?.consumption !== undefined) {
    return Number(row.consumption) || 0;
  }
  return Math.max(
    0,
    (Number(row?.current_value) || 0) - (Number(row?.previous_value) || 0)
  );
}

function production(row: any) {
  return Number(row?.value) || 0;
}

function emptyResponse() {
  return {
    parks: [],
    overview: {
      todayElec: 0,
      monthElec: 0,
      todaySolar: 0,
      monthSolar: 0,
      todayWater: 0,
      monthWater: 0,
    },
    structure: {
      buildings: 0,
      floors: 0,
      electricMeters: 0,
      waterMeters: 0,
      solarInverters: 0,
    },
    charts: {
      elecByBuilding: [],
      elecHistory: [],
      solarByBuilding: [],
      solarHistory: [],
      waterByBuilding: [],
      waterHistory: [],
      elecByPark: [],
      waterByPark: [],
      solarByPark: [],
    },
    readingStatus: { total: 0, readToday: 0, pending: 0 },
    alerts: { spike: 0, lowerThanPrev: 0, zeroConsumption: 0, missingReading: 0 },
    meta: { today: cairoToday(), latestAvailableDate: null, hasTodayReadings: false },
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_active) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const requestedDate = request.nextUrl.searchParams.get("date")?.trim() || "";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : cairoToday();

  const monthStart = `${today.slice(0, 7)}-01`;
  const historyStart = shiftDate(today, -29);

  let parkIds: string[] = [];
  let parkNames: string[] = [];
  const parkMap = new Map<string, string>();

  if (user.role === "admin") {
    const { data, error } = await supabase
      .from("technology_parks")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      return NextResponse.json({ error: "LOAD_PARKS_FAILED", detail: error.message }, { status: 500 });
    }

    for (const p of data ?? []) {
      parkIds.push(p.id);
      parkNames.push(p.name);
      parkMap.set(p.id, p.name);
    }
  } else {
    const { data, error } = await supabase
      .from("user_park_access")
      .select("park_id, technology_parks(id, name)")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "LOAD_ACCESS_FAILED", detail: error.message }, { status: 500 });
    }

    for (const row of data ?? []) {
      const park = Array.isArray((row as any).technology_parks)
        ? (row as any).technology_parks[0]
        : (row as any).technology_parks;

      if (row.park_id && park?.name) {
        parkIds.push(row.park_id);
        parkNames.push(park.name);
        parkMap.set(row.park_id, park.name);
      }
    }
  }

  parkIds = [...new Set(parkIds)];
  parkNames = [...new Set(parkNames)];

  if (parkIds.length === 0) {
    return NextResponse.json(emptyResponse());
  }

  const { data: buildings, error: buildingError } = await supabase
    .from("buildings")
    .select("id, name_en, name_ar, technology_park_id")
    .in("technology_park_id", parkIds)
    .eq("is_active", true);

  if (buildingError) {
    return NextResponse.json({ error: "LOAD_BUILDINGS_FAILED", detail: buildingError.message }, { status: 500 });
  }

  const validBuildings = buildings ?? [];
  const buildingIds = validBuildings.map((b) => b.id);
  const targetBuildingIds = buildingIds.length ? buildingIds : [EMPTY_UUID];

  const buildingMap = new Map(
    validBuildings.map((b) => [b.id, b.name_en || b.name_ar || "Building"])
  );
  const buildingParkMap = new Map(
    validBuildings.map((b) => [b.id, b.technology_park_id])
  );

  const [
    { data: floors, error: floorError },
    { data: meters, error: meterError },
    { data: waterMetersAll, error: waterMeterError },
    { data: inverters, error: inverterError },
  ] = await Promise.all([
    supabase.from("floors").select("id").in("building_id", targetBuildingIds),
    supabase.from("meters").select("id, building_id, label_en, meter_code").in("building_id", targetBuildingIds).eq("is_active", true),
    
    // تم إضافة technology_park_id هنا صراحة لكي يتم التعرف عليه ومطابقته بدقة
    supabase.from("water_meters").select("id, building_id, technology_park_id, label_en").eq("is_active", true),
    
    supabase.from("solar_inverters").select("id, building_id, label_en, meter_code").in("building_id", targetBuildingIds).eq("is_active", true),
  ]);

  const firstError = floorError || meterError || waterMeterError || inverterError;
  if (firstError) {
    return NextResponse.json({ error: "LOAD_ASSETS_FAILED", detail: firstError.message }, { status: 500 });
  }

  const validMeters = meters ?? [];
  const validInverters = inverters ?? [];

  const validWaterMeters = (waterMetersAll ?? []).filter((w: any) => {
    if (w.technology_park_id && parkIds.includes(w.technology_park_id)) return true;
    if (w.building_id && buildingIds.includes(w.building_id)) return true;
    if (!w.technology_park_id && !w.building_id) return true;
    return false;
  });

  const meterIds = validMeters.map((m) => m.id);
  const waterMeterIds = validWaterMeters.map((w: any) => w.id);
  const inverterIds = validInverters.map((i) => i.id);

  const [
    { data: elecReadings, error: elecError },
    { data: waterReadings, error: waterError },
    { data: solarReadings, error: solarError },
  ] = await Promise.all([
    meterIds.length
      ? supabase.from("electric_readings").select("meter_id, reading_date, consumption, current_value, previous_value, created_at").in("meter_id", meterIds).gte("reading_date", historyStart).lte("reading_date", today).order("reading_date", { ascending: false }).limit(5000)
      : Promise.resolve({ data: [], error: null }),

    waterMeterIds.length
      ? supabase.from("water_readings").select("water_meter_id, reading_date, consumption, current_value, previous_value, created_at").in("water_meter_id", waterMeterIds).gte("reading_date", historyStart).lte("reading_date", today).order("reading_date", { ascending: false }).limit(5000)
      : Promise.resolve({ data: [], error: null }),

    inverterIds.length
      ? supabase.from("solar_production").select("inverter_id, production_date, value, created_at").in("inverter_id", inverterIds).gte("production_date", historyStart).lte("production_date", today).order("production_date", { ascending: false }).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const readingError = elecError || waterError || solarError;
  if (readingError) {
    return NextResponse.json({ error: "LOAD_READINGS_FAILED", detail: readingError.message }, { status: 500 });
  }

  const elec = elecReadings ?? [];
  const water = waterReadings ?? [];
  const solar = solarReadings ?? [];

  const todayElec = elec.filter((r) => dateOf(r.reading_date) === today).reduce((s, r) => s + consumption(r), 0);
  const monthElec = elec.filter((r) => dateOf(r.reading_date) >= monthStart && dateOf(r.reading_date) <= today).reduce((s, r) => s + consumption(r), 0);

  const todayWater = water.filter((r) => dateOf(r.reading_date) === today).reduce((s, r) => s + consumption(r), 0);
  const monthWater = water.filter((r) => dateOf(r.reading_date) >= monthStart && dateOf(r.reading_date) <= today).reduce((s, r) => s + consumption(r), 0);

  const todaySolar = solar.filter((r) => dateOf(r.production_date) === today).reduce((s, r) => s + production(r), 0);
  const monthSolar = solar.filter((r) => dateOf(r.production_date) >= monthStart && dateOf(r.production_date) <= today).reduce((s, r) => s + production(r), 0);

  const elecByBuilding = new Map<string, number>();
  for (const r of elec.filter((x) => dateOf(x.reading_date) === today)) {
    const meter = validMeters.find((m) => m.id === r.meter_id);
    if (!meter) continue;
    const name = buildingMap.get(meter.building_id) ?? "Building";
    elecByBuilding.set(name, (elecByBuilding.get(name) ?? 0) + consumption(r));
  }

  const waterByBuilding = new Map<string, number>();
  for (const r of water.filter((x) => dateOf(x.reading_date) === today)) {
    const meter: any = validWaterMeters.find((w: any) => w.id === r.water_meter_id);
    let name = "Unassigned";
    if (meter?.building_id) {
      name = buildingMap.get(meter.building_id) ?? "Building";
    }
    waterByBuilding.set(name, (waterByBuilding.get(name) ?? 0) + consumption(r));
  }

  const solarByBuilding = new Map<string, number>();
  for (const r of solar.filter((x) => dateOf(x.production_date) === today)) {
    const inv = validInverters.find((i) => i.id === r.inverter_id);
    if (!inv) continue;
    const name = buildingMap.get(inv.building_id) ?? "Building";
    solarByBuilding.set(name, (solarByBuilding.get(name) ?? 0) + production(r));
  }

  const aggregateHistory = (rows: any[], dateField: string, valueFn: (r: any) => number) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = dateOf(r[dateField]);
      if (!d) continue;
      map.set(d, (map.get(d) ?? 0) + valueFn(r));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  };

  const elecHistory = aggregateHistory(elec, "reading_date", consumption).map(([date, value]) => ({ date: date.slice(5), consumption: Math.round(value) }));
  const waterHistory = aggregateHistory(water, "reading_date", consumption).map(([date, value]) => ({ date: date.slice(5), consumption: Math.round(value) }));
  const solarHistory = aggregateHistory(solar, "production_date", production).map(([date, value]) => ({ date: date.slice(5), yield: Math.round(value) }));

  const parkTotal = (
    rows: any[],
    idField: string,
    valueFn: (r: any) => number,
    assetMap: Map<string, any>,
    buildingIdField?: string
  ) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const asset = assetMap.get(r[idField]);
      if (!asset) continue;

      // أولوية التحقق من technology_park_id المباشر، أو من خلال الـ building
      const parkId = asset.technology_park_id || (buildingIdField ? buildingParkMap.get(asset[buildingIdField]) : null);
      const name = parkId ? parkMap.get(parkId) : null;
      if (!name) continue;

      map.set(name, (map.get(name) ?? 0) + valueFn(r));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) }));
  };

  const meterMap = new Map(validMeters.map((m) => [m.id, m]));
  const waterMap = new Map(validWaterMeters.map((m: any) => [m.id, m]));
  const inverterMap = new Map(validInverters.map((i) => [i.id, i]));

  const elecByPark = parkTotal(elec, "meter_id", consumption, meterMap, "building_id");
  
  // تمرير "building_id" هنا يضمن ربط استهلاك عدادات المياه بالبارك الصحيح بالكامل
  const waterByPark = parkTotal(water, "water_meter_id", consumption, waterMap, "building_id");
  
  const solarByPark = parkTotal(solar, "inverter_id", production, inverterMap, "building_id");

  const todayElecIds = new Set(elec.filter((r) => dateOf(r.reading_date) === today).map((r) => r.meter_id));
  const todayWaterIds = new Set(water.filter((r) => dateOf(r.reading_date) === today).map((r) => r.water_meter_id));
  const todaySolarIds = new Set(solar.filter((r) => dateOf(r.production_date) === today).map((r) => r.inverter_id));

  const totalAssets = validMeters.length + validWaterMeters.length + validInverters.length;
  const readToday = todayElecIds.size + todayWaterIds.size + todaySolarIds.size;

  let spike = 0;
  let lowerThanPrev = 0;
  let zeroConsumption = 0;

  const latestByMeter = new Map<string, any[]>();
  for (const r of elec) {
    const list = latestByMeter.get(r.meter_id) ?? [];
    list.push(r);
    latestByMeter.set(r.meter_id, list);
  }

  for (const [, rows] of latestByMeter) {
    const todayRow = rows.find((r) => dateOf(r.reading_date) === today);
    if (!todayRow) continue;
    if ((Number(todayRow.current_value) || 0) < (Number(todayRow.previous_value) || 0)) lowerThanPrev++;
    if (consumption(todayRow) === 0) zeroConsumption++;
  }

  for (const r of water.filter((x) => dateOf(x.reading_date) === today)) {
    if ((Number(r.current_value) || 0) < (Number(r.previous_value) || 0)) lowerThanPrev++;
    if (consumption(r) === 0) zeroConsumption++;
  }

  for (const r of solar.filter((x) => dateOf(x.production_date) === today)) {
    if (production(r) === 0) zeroConsumption++;
  }

  const latestAvailableDate = [
    ...elec.map((r) => dateOf(r.reading_date)),
    ...water.map((r) => dateOf(r.reading_date)),
    ...solar.map((r) => dateOf(r.production_date)),
  ].filter(Boolean).sort().pop() ?? null;

  return NextResponse.json({
    parks: parkNames,
    overview: {
      todayElec: Math.round(todayElec),
      monthElec: Math.round(monthElec),
      todaySolar: Math.round(todaySolar),
      monthSolar: Math.round(monthSolar),
      todayWater: Math.round(todayWater),
      monthWater: Math.round(monthWater),
    },
    structure: {
      buildings: validBuildings.length,
      floors: floors?.length ?? 0,
      electricMeters: validMeters.length,
      waterMeters: validWaterMeters.length,
      solarInverters: validInverters.length,
    },
    charts: {
      elecByBuilding: [...elecByBuilding.entries()].map(([name, value]) => ({ name, value: Math.round(value) })),
      elecHistory,
      solarByBuilding: [...solarByBuilding.entries()].map(([name, value]) => ({ name, value: Math.round(value) })),
      solarHistory,
      waterByBuilding: [...waterByBuilding.entries()].map(([name, value]) => ({ name, value: Math.round(value) })),
      waterHistory,
      elecByPark,
      waterByPark,
      solarByPark,
    },
    readingStatus: { total: totalAssets, readToday, pending: Math.max(0, totalAssets - readToday) },
    alerts: { spike, lowerThanPrev, zeroConsumption, missingReading: Math.max(0, totalAssets - readToday) },
    meta: { today, latestAvailableDate, hasTodayReadings: readToday > 0, historyStart },
  });
}
