import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "NOT_SIGNED_IN" }, { status: 401 });
  return NextResponse.json({ user });
}
