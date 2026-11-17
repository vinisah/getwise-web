import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { listStaffUsers } from "@/lib/staff-users";

/** GET /api/users?page=1 — acessos da equipe; paginação informada nos headers. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("users");

  const result = await listStaffUsers(req.nextUrl.searchParams.get("page"));
  return NextResponse.json(result.users, {
    headers: {
      "X-Total-Count": String(result.total),
      "X-Page": String(result.page),
      "X-Page-Size": String(result.pageSize),
      "Cache-Control": "no-store",
    },
  });
});
