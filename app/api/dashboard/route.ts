import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targetParkIds: string[] = [];

  // 1. فحص صلاحيات المستخدم
  const { data: userData } = await supabase
    .from("users")
    .select("all_parks_access, role")
    .eq("id", user.id)
    .single();

  const isFullAccess = user.role === "admin" || userData?.all_parks_access;

  if (isFullAccess) {
    const { data: allParks } = await supabase.from("technology_parks").select("id");
    targetParkIds = (allParks ?? []).map((p) => p.id);
  } else {
    const { data: userParkLinks } = await supabase
      .from("user_park_access")
      .select("park_id")
      .eq("user_id", user.id);

    targetParkIds = (userParkLinks ?? []).map((p) => p.park_id).filter(Boolean);
  }

  const safeParkIds = targetParkIds.length ? targetParkIds : ["00000000-0000-0000-0000-000000000000"];

  // 2. جلب بيانات المناطق
  const { data: parksData } = await supabase
    .from("technology_parks")
    .select("id, name_en, name_ar")
    .in("id", safeParkIds);

  const finalParks = parksData ?? [];
  const parkNames = finalParks.map((p) => p.name_en || p.name_ar || "Technology Park");

  const parkMap = new Map(finalParks.map((p) => [p.id, p.name_en || p.name_ar || "Technology Park"]));

  // 3. جلب المباني
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name_en, name_ar, technology_park_id")
    .in("technology_park_id", safeParkIds);

  const validBuildings = buildings ?? [];
  const buildingIds = validBuildings.map((b) => b.id);
  const buildingMap = new Map(validBuildings.map((b) => [b.id, b.name_en || b.name_ar || "Building"]));
  const buildingParkMap = new Map(validBuildings.map((b) => [b.id, b.technology_park_id]));
  const safeBuildingIds = buildingIds.length ? buildingIds : ["00000000-0000-0000-0000-000000000000"];

  // 4. جلب العدادات بكل الأعمدة select("*") لتجنب أي خطأ في أسماء الأعمدة
  const [
    { count: floorCount },
    { data: electricMeters, error: elecMetersErr },
    { data: waterMeters },
    { data: solarInverters }
  ] = await Promise.all([
    supabase.from("floors").select("id", { count: "exact", head: true }).in("building_id", safeBuildingIds),
    supabase.from("meters").select("*").in("building_id", safeBuildingIds),
    supabase.from("water_meters").select("*").in("building_id", safeBuildingIds),
    supabase.from("solar_inverters").select("*").in("building_id", safeBuildingIds),
  ]);

  const validElecMeters = electricMeters ?? [];
  const validWaterMeters = waterMeters ?? [];
  const validSolarInverters = solarInverters ?? [];

  const safeElecIds = validElecMeters.length ? validElecMeters.map((m: any) => m.id) : ["00000000-0000-0000-0000-000000000000"];
  const safeWaterIds = validWaterMeters.length ? validWaterMeters.map((w: any) => w.id) : ["00000000-0000-0000-0000-000000000000"];
  const safeSolarIds = validSolarInverters.length ? validSolarInverters.map((s: any) => s.id) : ["00000000-0000-0000-0000-000000000000"];

  // 5. جلب القراءات
  const [
    { data: elecReadings },
    { data: waterReadings },
    { data: solarReadings }
  ] = await Promise.all([
    supabase.from("electric_readings").select("*").in("meter_id", safeElecIds).order("created_at", { ascending: false }).limit(1000),
    supabase.from("water_readings").select("*").in("water_meter_id", safeWaterIds).order("created_at", { ascending: false }).limit(1000),
    supabase.from("solar_production").select("*").in("inverter_id", safeSolarIds).order("created_at", { ascending: false }).limit(1000),
  ]);

  const parseVal = (r: any) => {
    if (!r) return 0;
    for (const key of Object.keys(r)) {
      if (["consumption", "kwh_reading", "reading_value", "current_value", "reading", "value", "daily_yield_kwh", "active_energy", "energy", "production_kwh"].includes(key.toLowerCase())) {
        const num = Number(r[key]);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return 0;
  };

  const getDate = (r: any) => String(r?.reading_date || r?.created_at || "").slice(0, 10);

  const safeElec = elecReadings ?? [];
  const safeWater = waterReadings ?? [];
  const safeSolar = solarReadings ?? [];

  const latestElecDate = safeElec[0] ? getDate(safeElec[0]) : "";
  const latestWaterDate = safeWater[0] ? getDate(safeWater[0]) : "";
  const latestSolarDate = safeSolar[0] ? getDate(safeSolar[0]) : "";

  const todayElec = safeElec.filter((r) => getDate(r) === latestElecDate).reduce((acc, r) => acc + parseVal(r), 0);
  const monthElec = safeElec.reduce((acc, r) => acc + parseVal(r), 0);

  const todayWater = safeWater.filter((r) => getDate(r) === latestWaterDate).reduce((acc, r) => acc + parseVal(r), 0);
  const monthWater = safeWater.reduce((acc, r) => acc + parseVal(r), 0);

  const todaySolar = safeSolar.filter((r) => getDate(r) === latestSolarDate).reduce((acc, r) => acc + parseVal(r), 0);
  const monthSolar = safeSolar.reduce((acc, r) => acc + parseVal(r), 0);

  // خريطة لتخزين العدادات حسب المنطقة
  const parkMetersMap = new Map<string, any[]>();

  finalParks.forEach((p) => {
    const pName = p.name_en || p.name_ar || "Technology Park";
    parkMetersMap.set(pName, []);
  });

  validElecMeters.forEach((meter: any) => {
    let parkId = meter.technology_park_id || meter.park_id || buildingParkMap.get(meter.building_id);
    
    if (!parkId && finalParks.length > 0) {
      parkId = finalParks[0].id;
    }
    
    const parkName = parkMap.get(parkId) || (finalParks[0] ? (finalParks[0].name_en || finalParks[0].name_ar) : "Technology Park");

    const meterReadings = safeElec.filter((r) => r.meter_id === meter.id);
    const todayReadings = meterReadings.filter((r) => getDate(r) === latestElecDate);
    
    let meterConsumption = todayReadings.reduce((acc, r) => acc + parseVal(r), 0);
    if (meterConsumption === 0 && meterReadings.length > 0) {
      meterConsumption = parseVal(meterReadings[0]);
    }

    // التعرف المرن على الحقول حتى وإن اختلفت مسماها في قاعدة البيانات
    const category = (meter.category || meter.type || meter.voltage_type || meter.voltage || "MEDIUM").toString().toUpperCase();
    const code = meter.meter_code || meter.code || meter.serial_number || meter.id;
    const label = meter.label_en || meter.name_en || meter.name || meter.label || code;

    const list = parkMetersMap.get(parkName) || [];
    list.push({
      id: meter.id,
      code: code,
      label: label,
      category: category,
      consumption: meterConsumption,
    });
    parkMetersMap.set(parkName, list);
  });

  const parksDailyElec = finalParks.map((p) => {
    const parkName = p.name_en || p.name_ar || "Technology Park";
    const metersList = parkMetersMap.get(parkName) || [];
    const totalConsumption = metersList.reduce((sum, m) => sum + m.consumption, 0);
    
    return {
      name: parkName,
      consumption: totalConsumption,
      value: totalConsumption,
      meters: metersList,
    };
  });

  const elecByBuildingMap = new Map<string, number>();
  safeElec.forEach((r) => {
    const meter = validElecMeters.find((m: any) => m.id === r.meter_id);
    const bName = meter ? (buildingMap.get(meter.building_id) ?? "Building") : "Building";
    elecByBuildingMap.set(bName, (elecByBuildingMap.get(bName) ?? 0) + parseVal(r));
  });

  const waterByBuildingMap = new Map<string, number>();
  safeWater.forEach((r) => {
    const meter = validWaterMeters.find((w: any) => w.id === (r.water_meter_id || r.meter_id));
    const bName = meter ? (buildingMap.get(meter.building_id) ?? "Building") : "Building";
    waterByBuildingMap.set(bName, (waterByBuildingMap.get(bName) ?? 0) + parseVal(r));
  });

  const solarByBuildingMap = new Map<string, number>();
  safeSolar.forEach((r) => {
    const inv = validSolarInverters.find((s: any) => s.id === r.inverter_id);
    const bName = inv ? (buildingMap.get(inv.building_id) ?? "Building") : "Building";
    solarByBuildingMap.set(bName, (solarByBuildingMap.get(bName) ?? 0) + parseVal(r));
  });

  const elecHistoryMap = new Map<string, number>();
  safeElec.forEach((r) => {
    const d = getDate(r).slice(5);
    if (d) elecHistoryMap.set(d, (elecHistoryMap.get(d) ?? 0) + parseVal(r));
  });

  const waterHistoryMap = new Map<string, number>();
  safeWater.forEach((r) => {
    const d = getDate(r).slice(5);
    if (d) waterHistoryMap.set(d, (waterHistoryMap.get(d) ?? 0) + parseVal(r));
  });

  const solarHistoryMap = new Map<string, number>();
  safeSolar.forEach((r) => {
    const d = getDate(r).slice(5);
    if (d) solarHistoryMap.set(d, (solarHistoryMap.get(d) ?? 0) + parseVal(r));
  });

  const totalAssets = validElecMeters.length + validWaterMeters.length + validSolarInverters.length;
  const readTodayCount = safeElec.length + safeWater.length + safeSolar.length;

  return NextResponse.json({
    parks: parkNames,
    parksDailyElec,
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
      floors: floorCount ?? 0,
      electricMeters: validElecMeters.length,
      waterMeters: validWaterMeters.length,
      solarInverters: validSolarInverters.length,
    },
    charts: {
      elecByPark: parksDailyElec,
      elecByBuilding: Array.from(elecByBuildingMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) })),
      elecHistory: Array.from(elecHistoryMap.entries()).reverse().map(([date, consumption]) => ({ date, consumption: Math.round(consumption) })),
      solarByBuilding: Array.from(solarByBuildingMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) })),
      solarHistory: Array.from(solarHistoryMap.entries()).reverse().map(([date, yield_val]) => ({ date, yield: Math.round(yield_val) })),
      waterByBuilding: Array.from(waterByBuildingMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) })),
      waterHistory: Array.from(waterHistoryMap.entries()).reverse().map(([date, consumption]) => ({ date, consumption: Math.round(consumption) })),
    },
    readingStatus: {
      total: totalAssets,
      readToday: readTodayCount,
      pending: Math.max(0, totalAssets - readTodayCount),
    },
    alerts: {
      spike: 0,
      lowerThanPrev: 0,
      zeroConsumption: 0,
      missingReading: Math.max(0, totalAssets - readTodayCount),
    },
  });
}