import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReadingEntityType } from "@/lib/utils/enumGuards";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

    if (!isReadingEntityType(body.entityType)) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    const entityType = body.entityType;
    const entityId = typeof body.entityId === "string" ? body.entityId : "";

    const currentValue = Number(body.currentValue);
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : "";
    const isLowerConfirmed = !!body.isLowerConfirmed;
    const lowerReason = typeof body.lowerReason === "string" ? body.lowerReason.slice(0, 500) : "";

    if (!entityId || isNaN(currentValue) || currentValue < 0) {
      return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const readingDate = `${year}-${month}-${day}`;
    const todayDay = now.getDate();

    // ---- SOLAR: production only ----
    if (entityType === "SOLAR") {
      const insertRow: Database["public"]["Tables"]["solar_production"]["Insert"] = {
        inverter_id: entityId,
        production_date: readingDate,
        value: currentValue,
        technician_id: user.id,
        notes: notes || null,
      };

      const { data, error } = await supabase.from("solar_production").insert(insertRow).select().single();
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "DUPLICATE_READING" }, { status: 409 });
        return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
      }
      return NextResponse.json({ reading: data }, { status: 201 });
    }

    let readingFrequency = "DAILY";
    let monthlyReadingDay = 1;

    if (entityType === "LOW" || entityType === "MEDIUM") {
      const { data: meter } = await supabase
        .from("meters")
        .select("reading_frequency, monthly_reading_day")
        .eq("id", entityId)
        .single();
      if (meter) {
        readingFrequency = meter.reading_frequency ?? "DAILY";
        monthlyReadingDay = meter.monthly_reading_day ?? 1;
      }
    } else if (entityType === "WATER") {
      const { data: wm } = await supabase
        .from("water_meters")
        .select("reading_frequency, monthly_reading_day")
        .eq("id", entityId)
        .single();
      if (wm) {
        readingFrequency = wm.reading_frequency ?? "DAILY";
        monthlyReadingDay = wm.monthly_reading_day ?? 1;
      }
    } else if (entityType === "KIOSK") {
      const { data: kiosk } = await supabase
        .from("kiosks")
        .select("reading_frequency, monthly_reading_day")
        .eq("id", entityId)
        .maybeSingle();
      readingFrequency = kiosk?.reading_frequency ?? "MONTHLY";
      monthlyReadingDay = kiosk?.monthly_reading_day ?? 1;
    }

    if (readingFrequency === "MONTHLY" && todayDay !== monthlyReadingDay) {
      return NextResponse.json({ error: "NOT_OPEN_TODAY" }, { status: 400 });
    }

    // ---- LOW / MEDIUM: electric_readings ----
    if (entityType === "LOW" || entityType === "MEDIUM") {
      const { data: latest } = await supabase
        .from("electric_readings")
        .select("current_value")
        .eq("meter_id", entityId)
        .lt("reading_date", readingDate)
        .order("reading_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // إذا لم توجد قراءة سابقة، نضع previousValue مساوياً لـ currentValue ليكون الاستهلاك الأول 0 (وليس صفر كارثي يسبب خطأ)
      const previousValue = latest ? Number(latest.current_value) : currentValue;

      if (latest && currentValue < Number(latest.current_value) && !isLowerConfirmed) {
        return NextResponse.json({ error: "LOWER_THAN_PREVIOUS", previousValue: Number(latest.current_value) }, { status: 409 });
      }
      if (latest && currentValue < Number(latest.current_value) && isLowerConfirmed && !lowerReason.trim()) {
        return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
      }

      const insertRow: Database["public"]["Tables"]["electric_readings"]["Insert"] = {
        meter_id: entityId,
        reading_date: readingDate,
        reading_frequency: readingFrequency as any,
        previous_value: previousValue,
        current_value: currentValue,
        is_lower_confirmed: isLowerConfirmed,
        notes: isLowerConfirmed && lowerReason ? `${notes}${notes ? " — " : ""}Lower reason: ${lowerReason}` : notes || null,
        technician_id: user.id,
      };

      const { data, error } = await supabase.from("electric_readings").insert(insertRow).select().single();
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "DUPLICATE_READING" }, { status: 409 });
        return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
      }
      return NextResponse.json({ reading: data }, { status: 201 });
    }

    // ---- WATER: water_readings ----
    if (entityType === "WATER") {
      const { data: latest } = await supabase
        .from("water_readings")
        .select("current_value")
        .eq("water_meter_id", entityId)
        .lt("reading_date", readingDate)
        .order("reading_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousValue = latest ? Number(latest.current_value) : currentValue;

      if (latest && currentValue < Number(latest.current_value) && !isLowerConfirmed) {
        return NextResponse.json({ error: "LOWER_THAN_PREVIOUS", previousValue: Number(latest.current_value) }, { status: 409 });
      }
      if (latest && currentValue < Number(latest.current_value) && isLowerConfirmed && !lowerReason.trim()) {
        return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
      }

      const insertRow: Database["public"]["Tables"]["water_readings"]["Insert"] = {
        water_meter_id: entityId,
        reading_date: readingDate,
        reading_frequency: readingFrequency as any,
        previous_value: previousValue,
        current_value: currentValue,
        is_lower_confirmed: isLowerConfirmed,
        notes: isLowerConfirmed && lowerReason ? `${notes}${notes ? " — " : ""}Lower reason: ${lowerReason}` : notes || null,
        technician_id: user.id,
      };

      const { data, error } = await supabase.from("water_readings").insert(insertRow).select().single();
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "DUPLICATE_READING" }, { status: 409 });
        return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
      }
      return NextResponse.json({ reading: data }, { status: 201 });
    }

    // ---- KIOSK: kiosk_readings ----
    const { data: latest } = await supabase
      .from("kiosk_readings")
      .select("current_value")
      .eq("kiosk_id", entityId)
      .lt("reading_date", readingDate)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousValue = latest ? Number(latest.current_value) : currentValue;

    if (latest && currentValue < Number(latest.current_value) && !isLowerConfirmed) {
      return NextResponse.json({ error: "LOWER_THAN_PREVIOUS", previousValue: Number(latest.current_value) }, { status: 409 });
    }
    if (latest && currentValue < Number(latest.current_value) && isLowerConfirmed && !lowerReason.trim()) {
      return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
    }

    const insertRow: Database["public"]["Tables"]["kiosk_readings"]["Insert"] = {
      kiosk_id: entityId,
      reading_date: readingDate,
      previous_value: previousValue,
      current_value: currentValue,
      is_lower_confirmed: isLowerConfirmed,
      notes: isLowerConfirmed && lowerReason ? `${notes}${notes ? " — " : ""}Lower reason: ${lowerReason}` : notes || null,
      technician_id: user.id,
    };

    const { data, error } = await supabase.from("kiosk_readings").insert(insertRow).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "DUPLICATE_READING" }, { status: 409 });
      return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ reading: data }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: "SERVER_EXCEPTION", detail: err?.message || String(err) }, { status: 500 });
  }
}