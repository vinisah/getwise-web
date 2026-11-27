import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { PlacementSchema } from "@/lib/pre-enrollment/placement-schema";
import { requestPlacement } from "@/lib/pre-enrollment/placement";
import { sendVerification } from "@/lib/pre-enrollment/service";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";
export const POST = withErrorHandler(async (req) => {
  const limit = await checkRateLimit(`register:${getClientIp(req)}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
  if (!limit.allowed) throw new ApiError(429, "Muitas tentativas. Aguarde um momento e tente novamente.");
  const parsed = z
    .object({ data: PlacementSchema, password: z.string().min(8).max(72), requestId: z.uuid() })
    .safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { data, password, requestId } = parsed.data;
  const result = await requestPlacement(data, { password, requestId });
  const emailSent = await sendVerification(data.contact.email);
  return NextResponse.json({ ...result, emailSent }, { status: 201 });
});
