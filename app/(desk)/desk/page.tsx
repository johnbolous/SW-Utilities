import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/DashboardShell";
import DeskDashboardContent from "./DeskDashboardContent";

export const metadata = { title: "Desk – Silicon Waha Utilities Portal" };
export const dynamic = "force-dynamic";

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

  let targetParkIds: string[] = [];

  if (user.role === "admin" || dbUser?.all_parks_access) {
    const { data: allParks } = await supabase.from("technology_parks").select("id, name");
    if (allParks) {
      targetParkIds = (allParks as any[]).map((p) => p.id).filter((id): id is string => Boolean(id));
    }
  } else {
    const { data: accessRows } = await supabase
      .from("user_park_access")
      .select("park_id")
      .eq("user_id", user.id);

    if (accessRows && accessRows.length > 0) {
      targetParkIds = (accessRows as any[]).map((r) => r.park_id).filter((id): id is string => Boolean(id));
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

    if (parksData && parksData.length > 0) {
      parksDataMap = parksData;
      parkNames = (parksData as any[]).map((p) => p.name || "Park");
      finalParkIds = (parksData as any[]).map((p) => p.id).filter((id): id is string => Boolean(id));
    }
  }

  const safeParkIds = finalParkIds.length ? finalParkIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: buildings } = await supabase.from("buildings").select("id, technology_park_id").in("technology_park_id", safeParkIds);
  const buildingIds = ((buildings as any[]) ?? []).map((b) => b.id).filter((id): id is string => Boolean(id));
  const safeBuildingIds = buildingIds.length ? buildingIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    { count: floorCount },
    { data: electricMeters, error: elecError },
    { data: waterMeters },
    { data: solarInverters }
  ] = await Promise.all([
    supabase.from("floors").select("id", { count: "exact", head: true }).in("building_id", safeBuildingIds),
    supabase
      .from("meters")
      .select("id, building_id, category, meter_code, label_en, label_ar, tenant_name")
      .in("building_id", safeBuildingIds),
    supabase
      .from("water_meters")
      .select("id, building_id, meter_code, label_en, label_ar")
      .in("building_id", safeBuildingIds),
    supabase.from("solar_inverters").select("*"),
  ]);

  if (elecError) {
    console.error("Error fetching meters:", elecError);
  }

  const buildingToParkMap = new Map<string, string>();
  (((buildings as any[]) ?? [])).forEach((b: any) => {
    if (b?.id && b?.technology_park_id) {
      buildingToParkMap.set(b.id, b.technology_park_id);
    }
  });

  const parkIdToName = new Map<string, string>();
  parksDataMap.forEach((p: any) => {
    if (p?.id && p?.name) parkIdToName.set(p.id, p.name);
  });

  const getMeterParkId = (item: any) => {
    if (!item) return null;
    if (item.technology_park_id) return item.technology_park_id;
    if (item.park_id) return item.park_id;
    if (item.building_id) return buildingToParkMap.get(item.building_id) || null;
    return null;
  };

  const validElecMeters = (electricMeters as any[]) ?? [];
  const validWaterMeters = (waterMeters as any[]) ?? [];
  
  const rawSolarInverters = (solarInverters as any[]) ?? [];
  const validSolarInverters = rawSolarInverters.filter((s: any) => {
    const parkId = getMeterParkId(s);
    if (!parkId) return false;
    return targetParkIds.includes(parkId) || user.role === "admin" || dbUser?.all_parks_access;
  });

  const safeElecIds = validElecMeters.length ? validElecMeters.map((m: any) => m.id).filter((id): id is string => Boolean(id)) : ["00000000-0000-0000-0000-000000000000"];
  const safeWaterIds = validWaterMeters.length ? validWaterMeters.map((w: any) => w.id).filter((id): id is string => Boolean(id)) : ["00000000-0000-0000-0000-000000000000"];
  const safeSolarIds = validSolarInverters.length ? validSolarInverters.map((s: any) => s.id).filter((id): id is string => Boolean(id)) : ["00000000-0000-0000-0000-000000000000"];

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
    if (r.consumption !== undefined && r.consumption !== null) {
      return Number(r.consumption) || 0;
    }
    if (r.current_value !== undefined && r.previous_value !== undefined) {
      return Math.max(0, Number(r.current_value) - Number(r.previous_value));
    }
    const val = Number(r.value || r.kwh_reading || r.reading_value || 0);
    return isNaN(val) ? 0 : val;
  };

  const getDate = (r: any) => {
    if (!r) return "";
    if (typeof r === "string") return r.slice(0, 10);
    if (r.reading_date) return String(r.reading_date).slice(0, 10);
    if (r.created_at) {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(r.created_at));
      } catch {
        return String(r.created_at).slice(0, 10);
      }
    }
    return "";
  };

  const todayDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const safeElec = (elecReadings as any[]) ?? [];
  const safeWater = (waterReadings as any[]) ?? [];
  const safeSolar = (solarReadings as any[]) ?? [];

  const todayElec = safeElec.filter((r: any) => getDate(r) === todayDateStr).reduce((acc: number, r: any) => acc + parseVal(r), 0);
  const monthElec = safeElec.reduce((acc: number, r: any) => acc + parseVal(r), 0);

  const todayWater = safeWater.filter((r: any) => getDate(r) === todayDateStr).reduce((acc: number, r: any) => acc + parseVal(r), 0);
  const monthWater = safeWater.reduce((acc: number, r: any) => acc + parseVal(r), 0);

  const todaySolar = safeSolar.filter((r: any) => getDate(r) === todayDateStr).reduce((acc: number, r: any) => acc + parseVal(r), 0);
  const monthSolar = safeSolar.reduce((acc: number, r: any) => acc + parseVal(r), 0);

  const parksDailyElec = parksDataMap.map((park: any) => {
    const parkMeters = validElecMeters
      .filter((m: any) => getMeterParkId(m) === park.id)
      .map((m: any) => {
        const meterReadings = safeElec.filter((r: any) => r.meter_id === m.id);
        const totalConsumption = meterReadings.reduce((sum: number, r: any) => sum + parseVal(r), 0);
        const todayConsumption = meterReadings
          .filter((r: any) => getDate(r) === todayDateStr)
          .reduce((sum: number, r: any) => sum + parseVal(r), 0);

        return {
          id: m.id,
          code: m.meter_code || `Meter-${String(m.id).slice(0, 6)}`,
          label: m.label_en || m.label_ar || m.meter_code || `Meter-${String(m.id).slice(0, 6)}`,
          tenant: m.tenant_name || "",
          category: m.category || "MEDIUM",
          consumption: todayConsumption,      
          totalConsumption: totalConsumption, 
        };
      });

    const totalParkDaily = parkMeters.reduce((sum, m) => sum + m.consumption, 0);
    const totalParkTotal = parkMeters.reduce((sum, m) => sum + m.totalConsumption, 0);

    return {
      id: park.id,
      name: park.name,
      consumption: totalParkDaily,      
      totalConsumption: totalParkTotal,  
      meters: parkMeters,
    };
  });

  const parksWaterData = parksDataMap.map((park: any) => {
    const parkWaterMeters = validWaterMeters
      .filter((w: any) => getMeterParkId(w) === park.id)
      .map((w: any) => {
        const meterReadings = safeWater.filter((r: any) => r.water_meter_id === w.id);
        const totalConsumption = meterReadings.reduce((sum: number, r: any) => sum + parseVal(r), 0);
        const todayConsumption = meterReadings
          .filter((r: any) => getDate(r) === todayDateStr)
          .reduce((sum: number, r: any) => sum + parseVal(r), 0);

        return {
          id: w.id,
          code: w.meter_code || `Water-${String(w.id).slice(0, 6)}`,
          label: w.label_en || w.label_ar || w.meter_code || `Water-${String(w.id).slice(0, 6)}`,
          consumption: todayConsumption,
          totalConsumption,
        };
      });

    const totalParkDaily = parkWaterMeters.reduce((sum, m) => sum + m.consumption, 0);
    const totalParkTotal = parkWaterMeters.reduce((sum, m) => sum + m.totalConsumption, 0);

    return {
      id: park.id,
      name: park.name,
      consumption: totalParkDaily,
      totalConsumption: totalParkTotal,
      meters: parkWaterMeters,
    };
  });

  const parksSolarData = parksDataMap.map((park: any) => {
    const parkInverters = validSolarInverters
      .filter((s: any) => getMeterParkId(s) === park.id)
      .map((s: any) => {
        const inverterReadings = safeSolar.filter((r: any) => r.inverter_id === s.id);
        const totalYield = inverterReadings.reduce((sum: number, r: any) => sum + parseVal(r), 0);
        const todayYield = inverterReadings
          .filter((r: any) => getDate(r) === todayDateStr)
          .reduce((sum: number, r: any) => sum + parseVal(r), 0);

        return {
          id: s.id,
          code: s.inverter_code || s.code || `Solar-${String(s.id).slice(0, 6)}`,
          label: s.label_en || s.label_ar || s.inverter_code || s.code || `Solar-${String(s.id).slice(0, 6)}`,
          yield: todayYield,
          totalYield,
        };
      });

    const totalParkDaily = parkInverters.reduce((sum, i) => sum + i.yield, 0);
    const totalParkTotal = parkInverters.reduce((sum, i) => sum + i.totalYield, 0);

    return {
      id: park.id,
      name: park.name,
      yield: totalParkDaily,
      totalYield: totalParkTotal,
      inverters: parkInverters,
    };
  });

  const dashboardPayload = {
    parkNames,
    summary: {
      todayElec,
      monthElec,
      todayWater,
      monthWater,
      todaySolar,
      monthSolar,
      buildingsCount: ((buildings as any[]) ?? []).length,
      floorCount: floorCount ?? 0,
      electricMetersCount: validElecMeters.length,
      waterMetersCount: validWaterMeters.length,
      solarInvertersCount: validSolarInverters.length,
    },
    parksDailyElec,
    parksWaterData,
    parksSolarData,
  };

  return (
    <DashboardShell fullName={user.full_name} role={user.role}>
      <DeskDashboardContent data={dashboardPayload} />
    </DashboardShell>
  );
}
