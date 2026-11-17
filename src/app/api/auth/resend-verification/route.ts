import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerification } from "@/lib/pre-enrollment/service";
export const POST = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError(401, "Entre na sua conta para reenviar a confirmação.");
  if (!(await checkRateLimit(`resend:${session.user.id}`, 3, 3600000)).allowed)
    throw new ApiError(429, "Aguarde antes de reenviar a confirmação.");
  return NextResponse.json({ emailSent: await sendVerification(session.user.email!) });
});
