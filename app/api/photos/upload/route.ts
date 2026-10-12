import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEntity } from "@/lib/data/entityLookup";
import { checkImageQuality } from "@/lib/images/qualityCheck";
import { applyWatermark } from "@/lib/images/watermark";
import { compressImage } from "@/lib/images/compress";
import { getFacilityTodayIso } from "@/lib/utils/serverDate";
import { isReadingEntityType } from "@/lib/utils/enumGuards";
import type { Database, ReadingEntityType } from "@/types/database";

// sharp needs the Node.js runtime, not Edge.
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** Count of existing photo versions for this exact entity + date, branched per entity type to keep every `.eq()` call statically typed against a known column name. */
async function countExistingVersions(
  supabase: ReturnType<typeof createAdminClient>,
  entityType: ReadingEntityType,
  entityId: string,
  readingDate: string
): Promise<number> {
  let query = supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("reading_entity_type", entityType)
    .eq("reading_date", readingDate);

  if (entityType === "LOW" || entityType === "MEDIUM") query = query.eq("meter_id", entityId);
  else if (entityType === "SOLAR") query = query.eq("inverter_id", entityId);
  else if (entityType === "WATER") query = query.eq("water_meter_id", entityId);
  else query = query.eq("kiosk_id", entityId);

  const { count } = await query;
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const entityTypeField = form.get("entityType");
  const entityIdField = form.get("entityId");
  const force = form.get("force") === "true";
  // Bug fix: readingDate used to be a client-supplied form field, trusted
  // as-is. Same issue as app/api/readings/route.ts — derive it server-side
  // instead, so a photo's date can't be spoofed independently of the
  // reading it belongs to.
  const readingDate = getFacilityTodayIso();

  if (!(file instanceof File) || !isReadingEntityType(entityTypeField) || typeof entityIdField !== "string" || !entityIdField) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  const entityType = entityTypeField;
  const entityId = entityIdField;

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "UNSUPPORTED_FORMAT" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const entity = await resolveEntity(entityType, entityId);
  if (!entity) return NextResponse.json({ error: "ENTITY_NOT_FOUND" }, { status: 404 });

  const originalBuffer = Buffer.from(await file.arrayBuffer());

  const quality = await checkImageQuality(originalBuffer);
  if (!quality.passed) {
    return NextResponse.json({ status: "rejected", reasons: quality.reasons }, { status: 422 });
  }
  if (quality.warning && !force) {
    // Don't save yet — let the technician choose Retake or Continue Anyway.
    return NextResponse.json({ status: "warning", reasons: quality.reasons });
  }

  const capturedAt = new Date();
  const watermarked = await applyWatermark(originalBuffer, {
    buildingName: entity.buildingName,
    meterCode: entity.meterCode,
    readingType: entityType,
    capturedAt,
  });
  const finalBuffer = await compressImage(watermarked);

  const supabase = createAdminClient();

  const existingVersions = await countExistingVersions(supabase, entityType, entityId, readingDate);
  const version = existingVersions + 1;
  const fileName = version === 1 ? `${readingDate}_${entity.meterCode}.jpg` : `${readingDate}_${entity.meterCode}-v${version}.jpg`;
  const storagePath = `${entityType.toLowerCase()}/${entity.meterCode}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("meter-photos")
    .upload(storagePath, finalBuffer, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "UPLOAD_FAILED", detail: uploadError.message }, { status: 500 });
  }

  const insertRow: Database["public"]["Tables"]["photos"]["Insert"] = {
    reading_entity_type: entityType,
    reading_date: readingDate,
    storage_path: storagePath,
    file_name: fileName,
    version,
    captured_by: user.id,
    captured_at: capturedAt.toISOString(),
    quality_warning: quality.warning,
    quality_notes: quality.reasons.join(" ") || null,
  };
  if (entityType === "LOW" || entityType === "MEDIUM") insertRow.meter_id = entityId;
  else if (entityType === "SOLAR") insertRow.inverter_id = entityId;
  else if (entityType === "WATER") insertRow.water_meter_id = entityId;
  else insertRow.kiosk_id = entityId;

  const { data: photo, error: insertError } = await supabase
    .from("photos")
    .insert(insertRow)
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from("meter-photos").remove([storagePath]);
    return NextResponse.json({ error: "DB_INSERT_FAILED", detail: insertError.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage
    .from("meter-photos")
    .createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({ status: "saved", photo, url: signed?.signedUrl ?? null }, { status: 201 });
}
