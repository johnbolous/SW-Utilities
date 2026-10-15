import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import { isReadingFrequency } from "@/lib/utils/enumGuards";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "engineer"]);
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  const q = searchParams.get("q") || "";
  const parkId = searchParams.get("parkId") || "";
  const buildingId = searchParams.get("buildingId") || "";
  const status = searchParams.get("status") || "";

  const supabase = createAdminClient();
  
  // الاستعلام مباشرة باستخدام أعمدة الجدول الفعلية
  let query: any = supabase.from("water_meters").select("*, buildings(id, name, technology_park_id)", { count: "exact" });

  if (q) query = query.or(`label_en.ilike.%${q}%,meter_code.ilike.%${q}%`);
  
  // بما أن العمود موجود في الجدول، يمكننا استخدامه مباشرة وبكل سهولة
  if (parkId) query = query.eq("technology_park_id", parkId);
  if (buildingId) query = query.eq("building_id", buildingId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    waterMeters: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
