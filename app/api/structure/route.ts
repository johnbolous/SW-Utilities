import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleBuildingIds } from "@/lib/admin/parkAccess";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "NOT_SIGNED_IN" },
      { status: 401 }
    );

  const supabase = createAdminClient();

  const accessibleBuildingIds = await getAccessibleBuildingIds(user);

  let allowedParkIds: string[] | null = null;
  if (user.role !== "admin" && !user.all_parks_access) {
    const { data: parkLinks } = await supabase
      .from("user_park_access")
      .select("park_id")
      .eq("user_id", user.id);
    allowedParkIds = (parkLinks ?? []).map((l: any) => l.park_id).filter(Boolean);
  }

  const [
    buildingsRes,
    floorsRes,
    roomsRes,
    metersRes,
    solarRes,
    waterRes,
    kiosksRes,
    parksRes,
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from("buildings")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (accessibleBuildingIds)
        q = q.in(
          "id",
          accessibleBuildingIds.length
            ? accessibleBuildingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      return q;
    })(),

    (() => {
      let q = supabase
        .from("floors")
        .select("*")
        .order("sort_order");

      if (accessibleBuildingIds)
        q = q.in(
          "building_id",
          accessibleBuildingIds.length
            ? accessibleBuildingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      return q;
    })(),

    (() => {
      let q = supabase
        .from("rooms")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (accessibleBuildingIds)
        q = q.in(
          "building_id",
          accessibleBuildingIds.length
            ? accessibleBuildingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      return q;
    })(),

    (() => {
      let q = supabase
        .from("meters")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (accessibleBuildingIds)
        q = q.in(
          "building_id",
          accessibleBuildingIds.length
            ? accessibleBuildingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      return q;
    })(),

    (() => {
      let q = supabase
        .from("solar_inverters")
        .select("*")
        .eq("is_active", true)
        .order("inverter_no");

      if (accessibleBuildingIds)
        q = q.in(
          "building_id",
          accessibleBuildingIds.length
            ? accessibleBuildingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      return q;
    })(),

    supabase
      .from("water_meters")
      .select("*")
      .eq("is_active", true),

    supabase
      .from("kiosks")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from("technology_parks")
      .select("*")
      .eq("is_active", true)
      .order("name"),
  ]);

  const firstError = [
    buildingsRes,
    floorsRes,
    roomsRes,
    metersRes,
    solarRes,
    waterRes,
    kiosksRes,
    parksRes,
  ].find((r) => r.error);

  if (firstError?.error) {
    return NextResponse.json(
      {
        error: "STRUCTURE_LOAD_FAILED",
        detail: firstError.error.message,
      },
      { status: 500 }
    );
  }

  const buildingIdSet = accessibleBuildingIds
    ? new Set(accessibleBuildingIds)
    : null;

  const waterMeters = (waterRes.data ?? []).filter((w: any) => {
    if (user.role === "admin" || user.all_parks_access) return true;
    if (!allowedParkIds) return false;
    return w.technology_park_id && allowedParkIds.includes(w.technology_park_id);
  });

  const kiosks = (kiosksRes.data ?? []).filter(
    (k: any) =>
      !k.building_id ||
      !buildingIdSet ||
      buildingIdSet.has(k.building_id)
  );

  const parks = (parksRes.data ?? []).filter((p: any) => {
    if (user.role === "admin" || user.all_parks_access) return true;
    if (!allowedParkIds) return false;
    return allowedParkIds.includes(p.id);
  });

  return NextResponse.json({
    buildings: buildingsRes.data,
    floors: floorsRes.data,
    rooms: roomsRes.data,
    meters: metersRes.data,
    solarInverters: solarRes.data,
    waterMeters,
    kiosks,
    parks,
  });
}