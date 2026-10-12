import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/types/database";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "NOT_SIGNED_IN" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const patch: TablesUpdate<"users"> = {};

  if (body.theme === "dark" || body.theme === "light") {
    patch.theme = body.theme;
  }

  if (body.language === "en" || body.language === "ar") {
    patch.language = body.language;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "NOTHING_TO_UPDATE" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "UPDATE_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
