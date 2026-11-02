import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/DashboardShell";
import DeskDashboardContent from "./DeskDashboardContent";

export const metadata = { title: "Desk – Silicon Waha Utilities Portal" };
export const dynamic = "force-dynamic";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

// ───────────────────────── helpers ─────────────────────────

// العنصر (عداد / انفرتر / كشك) مفعّل؟ بيرجع false لو is_active = false أو status معطّل
function isActiveRow(x: any): boolean {
  if (!x) return false;
  if (x.is_active === false || x.active === false || x.enabled === false) return false;
  const st = String(x.status ?? "").trim().toLowerCase();
  return !["disabled", "disable", "inactive", "deactivated"].includes(st);
}

function toUtcDay(dateStr: any): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

function dayToMonthKey(day: number): string {
  const d = new Date(day * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthDay(day: number, months: number): number {
  const d = new Date(day * 86400000);
  d.setUTCMonth(d.getUTCMonth() + months);
  return Math.floor(d.getTime() / 86400000);
}

// تاريخ القراءة (YYYY-MM-DD): reading_date أولاً، وإلا created_at بتوقيت القاهرة
function getDate(r: any): string {
  if (!r) return "";
  if (typeof r === "string") return r.slice(0, 10);
  if (r.reading_date) return String(r.reading_date).slice(0, 10);
  if (r.created_at) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(r.created_at));
    } catch {
      return String(r.created_at).slice(0, 10);
    }
  }
  return "";
}

// القيمة المسجلة للقراءة (للطاقة الشمسية: الإنتاج)
function parseVal(r: any): number {
  if (!r) return 0;
  if (r.consumption !== undefined && r.consumption !== null) {
    return Number(r.consumption) || 0;
  }
  if (r.current_value !== undefined && r.previous_value !== undefined) {
    return Math.max(0, Number(r.current_value) - Number(r.previous_value));
  }
  const val = Number(r.value || r.kwh_reading || r.reading_value || 0);
  return isNaN(val) ? 0 : val;
}

// استهلاك قراءة واحدة (current - previous). القيم السالبة (استبدال/تصفير عداد) بتتحسب صفر.
function rowConsumption(r: any): number {
  if (!r) return 0;
  if (r.consumption !== undefined && r.consumption !== null) {
    const c = Number(r.consumption);
    return Number.isFinite(c) ? Math.max(0, c) : 0;
  }
  if (r.current_value !== undefined && r.previous_value !== undefined) {
    const d = Number(r.current_value) - Number(r.previous_value);
    return Number.isFinite(d) ? Math.max(0, d) : 0;
  }
  const v = Number(r.value ?? r.kwh_reading ?? r.reading_value ?? 0);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

type ConsumptionMode = "daily" | "periodic";

// حساب الاستهلاك اليومي والشهري من قراءات عنصر واحد:
// - daily    (قراءة كل يوم): استهلاك القراءة بيتنسب ليوم القراءة، ولو في أيام فايتة بيتوزع عليها.
// - periodic (قراءة شهرية):  استهلاك القراءة هو استهلاك الفترة اللي قبلها، فبيتوزع على أيام الفترة
//                            (قراءة 1 نوفمبر = استهلاك أكتوبر، مش نوفمبر).
// كل يوم بيروح لشهره، فالتقسيم بين الشهور بيطلع صح حتى لو القراءة في منتصف الشهر.
function analyzeConsumption(rows: any[], mode: ConsumptionMode, todayDay: number) {
  const monthly: { [monthKey: string]: number } = {};
  let todayValue = 0;
  let dailyAverage = 0;
  let lastDate: string | null = null;

  // ترتيب بالتاريخ، وآخر قراءة في نفس اليوم هي المعتمدة
  const perDay = new Map<number, any>();
  [...rows]
    .sort((a, b) => {
      const da = toUtcDay(getDate(a)) ?? 0;
      const db = toUtcDay(getDate(b)) ?? 0;
      if (da !== db) return da - db;
      return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
    })
    .forEach((r) => {
      const day = toUtcDay(getDate(r));
      if (day !== null) perDay.set(day, r);
    });

  const days = [...perDay.keys()].sort((a, b) => a - b);

  days.forEach((day, i) => {
    const value = rowConsumption(perDay.get(day));
    const prevDay = i > 0 ? days[i - 1] : null;

    let startDay: number;
    let endDay: number;
    if (mode === "daily") {
      startDay = prevDay !== null && day - prevDay > 1 ? prevDay + 1 : day;
      endDay = day;
    } else {
      startDay = prevDay !== null ? prevDay : shiftMonthDay(day, -1);
      endDay = Math.max(startDay, day - 1);
    }

    const span = endDay - startDay + 1;
    const perDayValue = value / span;
    for (let d = startDay; d <= endDay; d++) {
      const key = dayToMonthKey(d);
      monthly[key] = (monthly[key] || 0) + perDayValue;
      if (d === todayDay) todayValue += perDayValue;
    }

    if (i === days.length - 1) {
      dailyAverage = perDayValue;
      lastDate = getDate(perDay.get(day));
    }
  });

  return { monthly, todayValue, dailyAverage, lastDate };
}

// تجميع الإنتاج الشمسي: مجموع قيم كل شهر + قيمة اليوم
function sumByMonth(rows: any[], todayDateStr: string) {
  const monthly: { [monthKey: string]: number } = {};
  let todayValue = 0;
  rows.forEach((r) => {
    const date = getDate(r);
    if (!date) return;
    const val = parseVal(r);
    const key = date.slice(0, 7);
    monthly[key] = (monthly[key] || 0) + val;
    if (date === todayDateStr) todayValue += val;
  });
  return { monthly, todayValue };
}

// جلب كل القراءات (بدون حد 1000) لمجموعة عناصر ابتداءً من تاريخ معين
async function fetchReadings(
  supabase: any,
  table: string,
  idField: string,
  ids: string[],
  sinceIso: string
): Promise<any[]> {
  const rows: any[] = [];
  const validIds = ids.filter((id) => id && id !== ZERO_UUID);
  for (let i = 0; i < validIds.length; i += 100) {
    const chunk = validIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .in(idField, chunk)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) {
        console.error(`Error fetching ${table}:`, error);
        break;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
  }
  return rows;
}

function groupBy(rows: any[], field: string) {
  const map = new Map<string, any[]>();
  rows.forEach((r) => {
    const key = r?.[field];
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });
  return map;
}

// ───────────────────────── page ─────────────────────────

export default async function DeskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/unauthorized");
  if (!["engineer", "admin"].includes(user.role)) redirect("/unauthorized");

  const supabase = createAdminClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("all_parks_access")
    .eq("id", user.id)
    .maybeSingle();

  const hasAllParksAccess = Boolean(dbUser?.all_parks_access);

  let targetParkIds: string[] = [];

  if (user.role === "admin" || hasAllParksAccess) {
    const { data: allParks } = await supabase.from("technology_parks").select("id, name");
    if (Array.isArray(allParks)) {
      targetParkIds = allParks.map((p) => p?.id).filter(Boolean);
    }
  } else {
    const { data: accessRows } = await supabase
      .from("user_park_access")
      .select("park_id")
      .eq("user_id", user.id);

    if (Array.isArray(accessRows) && accessRows.length > 0) {
      targetParkIds = accessRows.map((r) => r?.park_id).filter(Boolean);
    }
  }

  let parksDataMap: any[] = [];
  let parkNames: string[] = [];
  let finalParkIds: string[] = [];

  if (targetParkIds.length > 0) {
    const { data: parksData } = await supabase
      .from("technology_parks")
      .select("id, name")
      .in("id", targetParkIds);

    if (Array.isArray(parksData) && parksData.length > 0) {
      parksDataMap = parksData;
      parkNames = parksData.map((p) => p?.name || "Park");
      finalParkIds = parksData.map((p) => p?.id).filter(Boolean);
    }
  }

  const safeParkIds = finalParkIds.length ? finalParkIds : [ZERO_UUID];
  const { data: buildings } = await supabase.from("buildings").select("id, technology_park_id").in("technology_park_id", safeParkIds);

  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const buildingIds = safeBuildings.map((b) => b?.id).filter(Boolean);
  const safeBuildingIds = buildingIds.length ? buildingIds : [ZERO_UUID];
  const parkIdsList = safeParkIds.join(",");

  const [
    { count: floorCount },
    { data: electricMeters, error: elecError },
    { data: waterMeters },
    { data: solarInverters },
    { data: kiosksRaw },
  ] = await Promise.all([
    supabase.from("floors").select("id", { count: "exact", head: true }).in("building_id", safeBuildingIds),
    supabase
      .from("meters")
      .select("id, building_id, technology_park_id, category, meter_code, label_en, label_ar, tenant_name, is_active, reading_frequency, monthly_reading_day")
      .or(`building_id.in.(${safeBuildingIds.join(",")}),technology_park_id.in.(${parkIdsList})`),
    supabase.from("water_meters").select("*").or(`building_id.in.(${safeBuildingIds.join(",")}),technology_park_id.in.(${parkIdsList})`),
    supabase.from("solar_inverters").select("*"),
    supabase.from("kiosks").select("*").in("park_id", safeParkIds),
  ]);

  if (elecError) {
    console.error("Error fetching meters:", elecError);
  }

  const buildingToParkMap = new Map<string, string>();
  safeBuildings.forEach((b) => {
    if (b?.id && b?.technology_park_id) {
      buildingToParkMap.set(b.id, b.technology_park_id);
    }
  });

  const getMeterParkId = (item: any) => {
    if (!item) return null;
    if (item.technology_park_id) return item.technology_park_id;
    if (item.park_id) return item.park_id;
    if (item.building_id) return buildingToParkMap.get(item.building_id) || null;
    return null;
  };

  // العناصر المعطّلة (is_active = false) بتتشال هنا من المصدر، فمش هتظهر في أي مكان في الصفحة
  const validElecMeters = (Array.isArray(electricMeters) ? electricMeters : []).filter(isActiveRow);
  const validWaterMeters = (Array.isArray(waterMeters) ? waterMeters : []).filter(isActiveRow);
  const validKiosks = (Array.isArray(kiosksRaw) ? kiosksRaw : []).filter(isActiveRow);

  const rawSolarInverters = Array.isArray(solarInverters) ? solarInverters : [];
  const validSolarInverters = rawSolarInverters.filter((s: any) => {
    if (!isActiveRow(s)) return false;
    const parkId = getMeterParkId(s);
    if (!parkId) return false;
    return targetParkIds.includes(parkId) || user.role === "admin" || hasAllParksAccess;
  });

  const safeElecIds = validElecMeters.map((m) => m?.id).filter(Boolean);
  const safeWaterIds = validWaterMeters.map((w) => w?.id).filter(Boolean);
  const safeSolarIds = validSolarInverters.map((s) => s?.id).filter(Boolean);
  const safeKioskIds = validKiosks.map((k) => k?.id).filter(Boolean);

  const todayDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayDay = toUtcDay(todayDateStr) as number;
  const currentMonthKey = todayDateStr.slice(0, 7);

  // نافذة القراءات: من أول الشهر قبل الماضي (كفاية لحساب الشهر الحالي وآخر شهر مكتمل)
  const sinceIso = new Date(
    Date.UTC(Number(todayDateStr.slice(0, 4)), Number(todayDateStr.slice(5, 7)) - 1 - 2, 1)
  ).toISOString();

  const [elecReadings, waterReadings, solarReadings, kioskReadings] = await Promise.all([
    fetchReadings(supabase, "electric_readings", "meter_id", safeElecIds, sinceIso),
    fetchReadings(supabase, "water_readings", "water_meter_id", safeWaterIds, sinceIso),
    fetchReadings(supabase, "solar_production", "inverter_id", safeSolarIds, sinceIso),
    fetchReadings(supabase, "kiosk_readings", "kiosk_id", safeKioskIds, sinceIso),
  ]);

  const elecByMeter = groupBy(elecReadings, "meter_id");
  const waterByMeter = groupBy(waterReadings, "water_meter_id");
  const solarByInverter = groupBy(solarReadings, "inverter_id");
  const kioskByKiosk = groupBy(kioskReadings, "kiosk_id");

  const modeOf = (item: any): ConsumptionMode =>
    String(item?.reading_frequency || "DAILY").toUpperCase() === "MONTHLY" ? "periodic" : "daily";

  const parksDailyElec = parksDataMap.map((park) => {
    const parkMeters = validElecMeters
      .filter((m: any) => getMeterParkId(m) === park.id)
      .map((m: any) => {
        const mode = modeOf(m);
        const a = analyzeConsumption(elecByMeter.get(m.id) || [], mode, todayDay);
        const mIdStr = m?.id ? String(m.id) : "000000";

        return {
          id: m.id,
          code: m.meter_code || `Meter-${mIdStr.slice(0, 6)}`,
          label: m.label_en || m.label_ar || m.meter_code || `Meter-${mIdStr.slice(0, 6)}`,
          tenant: m.tenant_name || "",
          category: m.category || "MEDIUM",
          reading_frequency: mode === "periodic" ? "MONTHLY" : "DAILY",
          // يومي: استهلاك اليوم (عداد يومي) أو متوسط يومي لآخر فترة (عداد شهري)
          consumption: mode === "daily" ? a.todayValue : a.dailyAverage,
          // الشهر الحالي، ولكل الشهور في monthly
          totalConsumption: a.monthly[currentMonthKey] ?? 0,
          monthly: a.monthly,
          lastReadingDate: a.lastDate,
        };
      });

    return {
      id: park.id,
      name: park.name,
      consumption: parkMeters.reduce((sum, m) => sum + m.consumption, 0),
      totalConsumption: parkMeters.reduce((sum, m) => sum + m.totalConsumption, 0),
      meters: parkMeters,
    };
  });

  const parksWaterData = parksDataMap.map((park) => {
    const parkWaterMeters = validWaterMeters
      .filter((w: any) => getMeterParkId(w) === park.id)
      .map((w: any) => {
        const mode = modeOf(w);
        const a = analyzeConsumption(waterByMeter.get(w.id) || [], mode, todayDay);
        const wIdStr = w?.id ? String(w.id) : "000000";

        return {
          id: w.id,
          code: w.meter_code || `Water-${wIdStr.slice(0, 6)}`,
          label: w.label_en || w.label_ar || w.meter_code || `Water-${wIdStr.slice(0, 6)}`,
          reading_frequency: mode === "periodic" ? "MONTHLY" : "DAILY",
          consumption: mode === "daily" ? a.todayValue : a.dailyAverage,
          totalConsumption: a.monthly[currentMonthKey] ?? 0,
          monthly: a.monthly,
          lastReadingDate: a.lastDate,
        };
      });

    return {
      id: park.id,
      name: park.name,
      consumption: parkWaterMeters.reduce((sum, m) => sum + m.consumption, 0),
      totalConsumption: parkWaterMeters.reduce((sum, m) => sum + m.totalConsumption, 0),
      meters: parkWaterMeters,
    };
  });

  const parksSolarData = parksDataMap.map((park) => {
    const parkInverters = validSolarInverters
      .filter((s: any) => getMeterParkId(s) === park.id)
      .map((s: any) => {
        const { monthly, todayValue } = sumByMonth(solarByInverter.get(s.id) || [], todayDateStr);
        const sIdStr = s?.id ? String(s.id) : "000000";

        return {
          id: s.id,
          code: s.inverter_code || s.code || `Solar-${sIdStr.slice(0, 6)}`,
          label: s.label_en || s.label_ar || s.inverter_code || s.code || `Solar-${sIdStr.slice(0, 6)}`,
          yield: todayValue,
          totalYield: monthly[currentMonthKey] ?? 0,
          monthly,
        };
      });

    return {
      id: park.id,
      name: park.name,
      yield: parkInverters.reduce((sum, i) => sum + i.yield, 0),
      totalYield: parkInverters.reduce((sum, i) => sum + i.totalYield, 0),
      inverters: parkInverters,
    };
  });

  // الأكشاك: قراءة شهرية (periodic)
  const parksKiosksData = parksDataMap.map((park) => {
    const parkKiosks = validKiosks
      .filter((k: any) => String(k?.park_id) === String(park.id))
      .map((k: any) => {
        const a = analyzeConsumption(kioskByKiosk.get(k.id) || [], "periodic", todayDay);
        const kioskRows = kioskByKiosk.get(k.id) || [];
        const latestRow = [...kioskRows].sort((x, y) => (getDate(x) < getDate(y) ? -1 : 1)).pop();

        return {
          ...k,
          consumption: a.dailyAverage, // متوسط يومي لآخر فترة بين قراءتين
          totalConsumption: a.monthly[currentMonthKey] ?? 0,
          monthly: a.monthly,
          last_reading_date: a.lastDate,
          last_reading_value: latestRow ? Number(latestRow.current_value) : null,
        };
      });

    return {
      id: park.id,
      name: park.name,
      kiosks: parkKiosks,
    };
  });

  const sum = (arr: any[], field: string) => arr.reduce((acc, p) => acc + Number(p?.[field] || 0), 0);

  const dashboardPayload = {
    parkNames,
    summary: {
      todayElec: sum(parksDailyElec, "consumption"),
      monthElec: sum(parksDailyElec, "totalConsumption"),
      todayWater: sum(parksWaterData, "consumption"),
      monthWater: sum(parksWaterData, "totalConsumption"),
      todaySolar: sum(parksSolarData, "yield"),
      monthSolar: sum(parksSolarData, "totalYield"),
      buildingsCount: safeBuildings.length,
      floorCount: floorCount ?? 0,
      electricMetersCount: validElecMeters.length,
      waterMetersCount: validWaterMeters.length,
      solarInvertersCount: validSolarInverters.length,
      kiosksCount: validKiosks.length,
    },
    parksDailyElec,
    parksWaterData,
    parksSolarData,
    parksKiosksData,
  };

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <DeskDashboardContent data={dashboardPayload} />
    </DashboardShell>
  );
}
