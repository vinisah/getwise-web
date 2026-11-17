import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";
import { SubmissionSchema } from "@/lib/pre-enrollment/schema";
import { submitApplication } from "@/lib/pre-enrollment/service";
export const POST = withErrorHandler(async (req) => {
  const limit = await checkRateLimit(`register:${getClientIp(req)}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
  if (!limit.allowed)
    return NextResponse.json({ error: `Muitas tentativas. Aguarde ${limit.retryAfter}s.` }, { status: 429 });
  const parsed = SubmissionSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Confira os campos indicados.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  return NextResponse.json(await submitApplication(parsed.data.data, parsed.data.password, parsed.data.requestId), {
    status: 201,
  });
});
