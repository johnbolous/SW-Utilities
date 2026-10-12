import { NextResponse, type NextRequest } from "next/server";
import { destroySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySessionToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
