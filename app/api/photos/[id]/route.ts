import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: photo } = await supabase.from("photos").select("*").eq("id", params.id).maybeSingle();
  if (!photo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Technicians may only view their own captures; engineers/admins see all —
  // matches "technicians can only enter readings" from the spec.
  if (user.role === "technician" && photo.captured_by !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: signed, error } = await supabase.storage
    .from("meter-photos")
    .createSignedUrl(photo.storage_path, 60 * 60);

  if (error || !signed) return NextResponse.json({ error: "SIGN_FAILED" }, { status: 500 });

  return NextResponse.json({ photo, url: signed.signedUrl });
}
