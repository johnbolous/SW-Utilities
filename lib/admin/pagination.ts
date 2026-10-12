import "server-only";
import type { NextRequest } from "next/server";

export function parsePagination(request: NextRequest, defaultPageSize = 20) {
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("pageSize") ?? String(defaultPageSize), 10) || defaultPageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
