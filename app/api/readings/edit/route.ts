import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReadingEditable, type ReadingTable } from "@/lib/admin/readingAccess";

type ExtendedReadingTable = ReadingTable | "main_distributor_readings";

function isReadingTable(value: unknown): value is ExtendedReadingTable {
  return (
    value === "electric_readings" ||
    value === "water_readings" ||
    value === "kiosk_readings" ||
    value === "solar_production" ||
    value === "main_distributor_readings"
  );
}

function validateEditWindow(userRole: string, readingDateStr: string | null): boolean {
  if (!readingDateStr) return true;
  const rDate = new Date(readingDateStr).toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const diffDays = Math.round((new Date(todayStr).getTime() - new Date(rDate).getTime()) / (1000 * 60 * 60 * 24));

  if (userRole === "technician") {
    return diffDays === 0;
  } else if (userRole === "engineer" || userRole === "admin") {
    return diffDays >= 0 && diffDays <= 7;
  }
  return false;
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  if (!isReadingTable(body.table)) return NextResponse.json({ error: "INVALID_TABLE" }, { status: 400 });
  const table = body.table;
  const id = typeof body.id === "string" ? body.id : "";
  const newValue = Number(body.newValue);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  if (isNaN(newValue) || newValue < 0) return NextResponse.json({ error: "INVALID_VALUE" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });

  const supabase = createAdminClient();

  if (table === "main_distributor_readings") {
    const { data: before } = await supabase.from("main_distributor_readings").select("*").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (!validateEditWindow(user.role, before.reading_date)) {
      return NextResponse.json({ error: "OUTSIDE_EDIT_WINDOW" }, { status: 403 });
    }

    const { data: after, error } = await supabase
      .from("main_distributor_readings")
      .update({ max_demand_mva: newValue })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "reading_edited",
      table_name: table,
      record_id: id,
      old_value: before,
      new_value: { ...after, _meta: { edited_by_username: user.username, edited_by_role: user.role, edited_at: new Date().toISOString() } },
      reason,
    });

    return NextResponse.json({ reading: after });
  }

  if (table === "electric_readings" || table === "water_readings" || table === "kiosk_readings") {
    const { data: before } =
      table === "electric_readings"
        ? await supabase.from("electric_readings").select("*").eq("id", id).maybeSingle()
        : table === "water_readings"
        ? await supabase.from("water_readings").select("*").eq("id", id).maybeSingle()
        : await supabase.from("kiosk_readings").select("*").eq("id", id).maybeSingle();

    if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (!validateEditWindow(user.role, before.reading_date)) {
      return NextResponse.json({ error: "OUTSIDE_EDIT_WINDOW" }, { status: 403 });
    }

    const isLowerConfirmed = newValue < before.current_value ? true : before.is_lower_confirmed;

    const { data: after, error } =
      table === "electric_readings"
        ? await supabase
            .from("electric_readings")
            .update({ current_value: newValue, is_lower_confirmed: isLowerConfirmed })
            .eq("id", id)
            .select()
            .single()
        : table === "water_readings"
        ? await supabase
            .from("water_readings")
            .update({ current_value: newValue, is_lower_confirmed: isLowerConfirmed })
            .eq("id", id)
            .select()
            .single()
        : await supabase
            .from("kiosk_readings")
            .update({ current_value: newValue, is_lower_confirmed: isLowerConfirmed })
            .eq("id", id)
            .select()
            .single();

    if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "reading_edited",
      table_name: table,
      record_id: id,
      old_value: before,
      new_value: { ...after, _meta: { edited_by_username: user.username, edited_by_role: user.role, edited_at: new Date().toISOString() } },
      reason,
    });

    return NextResponse.json({ reading: after });
  }

  const { data: before } = await supabase.from("solar_production").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!validateEditWindow(user.role, before.production_date)) {
    return NextResponse.json({ error: "OUTSIDE_EDIT_WINDOW" }, { status: 403 });
  }

  const { data: after, error } = await supabase
    .from("solar_production")
    .update({ value: newValue })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    user_id: user.id,
    action: "reading_edited",
    table_name: table,
    record_id: id,
    old_value: before,
    new_value: { ...after, _meta: { edited_by_username: user.username, edited_by_role: user.role, edited_at: new Date().toISOString() } },
    reason,
  });

  return NextResponse.json({ reading: after });
}