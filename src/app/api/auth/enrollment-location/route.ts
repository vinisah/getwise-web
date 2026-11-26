import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { lookupResidence, municipalityKey } from "@/lib/pre-enrollment/location";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";
export const GET = withErrorHandler(async (req) => {
  const limit = await checkRateLimit(`cep:${getClientIp(req)}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
  if (!limit.allowed) throw new ApiError(429, "Muitas consultas. Aguarde um momento e tente novamente.");
  const residence = await lookupResidence(req.nextUrl.searchParams.get("cep") ?? "");
  const units = await prisma.schoolUnit.findMany({
    where: { isActive: true, enrollmentOpen: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, city: true, state: true },
  });
  return NextResponse.json(
    {
      residence,
      localUnitIds: units
        .filter((u) => municipalityKey(u.city, u.state) === municipalityKey(residence.city, residence.state))
        .map((u) => u.id),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
