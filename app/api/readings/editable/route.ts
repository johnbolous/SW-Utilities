import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReadingEditable, type ReadingTable } from "@/lib/admin/readingAccess";
import { getUserParkAccess } from "@/lib/admin/parkAccess";
import { getFacilityTodayIso } from "@/lib/utils/serverDate";

interface EditableRow {
  table: ReadingTable;
  id: string;
  label: string;
  readingDate: string;
  previousValue: number | null;
  currentValue: number;
  technicianUsername: string;
}

const LOOKBACK_DAYS = 14;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

    const supabase = createAdminClient();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
    const access = await getUserParkAccess(user);

    let allowedParkIds: string[] = [];
    const isAdminOrAll = user.role === "admin" || user.all_parks_access;

    if (!isAdminOrAll) {
      const { data: userParkLinks } = await supabase
        .from("user_park_access")
        .select("park_id")
        .eq("user_id", user.id);

      if (userParkLinks) {
        allowedParkIds = userParkLinks.map((link: any) => link.park_id).filter(Boolean);
      }

      if (allowedParkIds.length === 0) {
        return NextResponse.json({ readings: [], today: getFacilityTodayIso() });
      }
    }

    let buildingIds: string[] = [];
    if (!isAdminOrAll) {
      const { data: bRows } = await supabase
        .from("buildings")
        .select("id")
        .in("technology_park_id", allowedParkIds);
      buildingIds = (bRows ?? []).map((b) => b.id);
    } else {
      const { data: bRows } = await supabase.from("buildings").select("id");
      buildingIds = (bRows ?? []).map((b) => b.id);
    }

    const safeBuildingIds = buildingIds.length > 0 ? buildingIds : ["00000000-0000-0000-0000-000000000000"];

    const [metersRes, waterMetersRes, kiosksRes, invertersRes, usersRes] = await Promise.all([
      supabase.from("meters").select("id, label_en, meter_code").in("building_id", safeBuildingIds),
      isAdminOrAll
        ? supabase.from("water_meters").select("id, label_en, meter_code, technology_park_id")
        : supabase.from("water_meters").select("id, label_en, meter_code, technology_park_id").in("technology_park_id", allowedParkIds),
      supabase.from("kiosks").select("id, name, meter_code").in("building_id", safeBuildingIds),
      supabase.from("solar_inverters").select("id, label_en, meter_code").in("building_id", safeBuildingIds),
      supabase.from("users").select("id, username"),
    ]);

    const metersData = metersRes.data ?? [];
    const waterMetersData = waterMetersRes.data ?? [];
    const kiosksData = kiosksRes.data ?? [];
    const invertersData = invertersRes.data ?? [];

    const meterIds = metersData.map((m) => m.id);
    const waterMeterIds = waterMetersData.map((m) => m.id);
    const kioskIds = kiosksData.map((k) => k.id);
    const inverterIds = invertersData.map((i) => i.id);

    const usernameById = new Map((usersRes.data ?? []).map((u) => [u.id, u.username]));
    const meterById = new Map(metersData.map((m) => [m.id, m]));
    const waterMeterById = new Map(waterMetersData.map((m) => [m.id, m]));
    const kioskById = new Map(kiosksData.map((k) => [k.id, k]));
    const inverterById = new Map(invertersData.map((i) => [i.id, i]));

    // جلب القراءات الأساسية مع حماية جدول الموزع لكي لا يعطل النظام لو حدث خطأ في أسمائه
    const [electric, water, kiosk, solar] = await Promise.all([
      meterIds.length > 0 ? supabase.from("electric_readings").select("*").in("meter_id", meterIds).gte("reading_date", since).order("reading_date", { ascending: false }).limit(200) : { data: [] },
      waterMeterIds.length > 0 ? supabase.from("water_readings").select("*").in("water_meter_id", waterMeterIds).gte("reading_date", since).order("reading_date", { ascending: false }).limit(200) : { data: [] },
      kioskIds.length > 0 ? supabase.from("kiosk_readings").select("*").in("kiosk_id", kioskIds).gte("reading_date", since).order("reading_date", { ascending: false }).limit(200) : { data: [] },
      inverterIds.length > 0 ? supabase.from("solar_production").select("*").in("inverter_id", inverterIds).gte("production_date", since).order("production_date", { ascending: false }).limit(200) : { data: [] },
    ]);

    let sgData: any[] = [];
    try {
      const sgRes = await supabase.from("main_distributor_readings").select("*").order("created_at", { ascending: false }).limit(100);
      if (sgRes.data) sgData = sgRes.data;
    } catch {
      // تجاهل الخطأ مؤقتاً لضمان عدم تعطل باقي الصفحة
    }

    const candidates: { table: ReadingTable | string; row: any; label: string; dateField: string }[] = [
      ...(electric.data ?? []).map((r) => ({ table: "electric_readings" as ReadingTable, row: r, label: meterById.get(r.meter_id)?.label_en ?? "—", dateField: "reading_date" })),
      ...(water.data ?? []).map((r) => ({ table: "water_readings" as ReadingTable, row: r, label: waterMeterById.get(r.water_meter_id)?.label_en ?? "—", dateField: "reading_date" })),
      ...(kiosk.data ?? []).map((r) => ({ table: "kiosk_readings" as ReadingTable, row: r, label: kioskById.get(r.kiosk_id)?.name ?? "—", dateField: "reading_date" })),
      ...(solar.data ?? []).map((r) => ({ table: "solar_production" as ReadingTable, row: r, label: inverterById.get(r.inverter_id)?.label_en ?? "—", dateField: "production_date" })),
      ...sgData.map((r: any) => ({ table: "main_distributor_readings", row: r, label: "SG Incoming Feeder", dateField: "reading_date" })),
    ];

    const results: (EditableRow & { canEdit: boolean })[] = [];
    for (const c of candidates) {
      let canEdit = true;
      if (c.table !== "main_distributor_readings") {
        try {
          const resCheck = await checkReadingEditable(user, c.table as ReadingTable, c.row, access);
          canEdit = resCheck.allowed;
        } catch {
          canEdit = user.role === "admin";
        }
      } else {
        canEdit = true; // السماح بالتعديل أو العرض للموزع
      }

      const rowUserId = c.row.technician_id ?? c.row.user_id;
      if (user.role === "technician" && rowUserId && rowUserId !== user.id) continue;

      const dateVal = c.row.reading_date ?? c.row.created_at?.slice(0, 10) ?? getFacilityTodayIso();

      results.push({
        table: c.table as ReadingTable,
        id: c.row.id,
        label: c.label,
        readingDate: dateVal,
        previousValue: c.table === "solar_production" || c.table === "main_distributor_readings" ? null : Number(c.row.previous_value),
        currentValue: c.table === "solar_production" 
          ? Number(c.row.value) 
          : c.table === "main_distributor_readings" 
          ? Number(c.row.max_demand_mva ?? 0) 
          : Number(c.row.current_value),
        technicianUsername: usernameById.get(rowUserId) ?? "—",
        canEdit: canEdit,
      });
    }

    results.sort((a, b) => (a.readingDate < b.readingDate ? 1 : -1));

    return NextResponse.json({ readings: results.slice(0, 100), today: getFacilityTodayIso() });
  } catch (err: any) {
    console.error("API Error in reading history:", err);
    return NextResponse.json({ error: err.message ?? "SERVER_ERROR" }, { status: 500 });
  }
}