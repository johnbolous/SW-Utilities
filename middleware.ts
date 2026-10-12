import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const ROLE_REQUIREMENTS: { prefix: string; roles: Array<"admin" | "engineer" | "technician"> }[] = [
  { prefix: "/field", roles: ["technician", "engineer", "admin"] },
  { prefix: "/desk", roles: ["engineer", "admin"] },
  { prefix: "/admin", roles: ["admin"] },
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const rule = ROLE_REQUIREMENTS.find((r) => path.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionToken(token);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", path);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  if (!rule.roles.includes(user.role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/field/:path*", "/desk/:path*", "/admin/:path*"],
};
