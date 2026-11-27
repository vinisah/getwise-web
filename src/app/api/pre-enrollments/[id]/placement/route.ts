import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { applicantSession } from "@/lib/pre-enrollment/session";
import { PlacementSchema } from "@/lib/pre-enrollment/placement-schema";
import { requestPlacement, decidePlacement } from "@/lib/pre-enrollment/placement";
import { audit } from "@/lib/audit";
const idOf = async (ctx: unknown) => (await (ctx as { params: Promise<{ id: string }> }).params).id;
export const PUT = withErrorHandler(async (req, ctx) => {
  const session = await applicantSession();
  const parsed = z.object({ data: PlacementSchema, version: z.number().int().positive() }).safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  return NextResponse.json(
    await requestPlacement(parsed.data.data, {
      applicationId: await idOf(ctx),
      applicantId: session.user.id,
      email: session.user.email,
      version: parsed.data.version,
    })
  );
});
export const POST = withErrorHandler(async (req, ctx) => {
  const session = await requireAdmin("pre-enrollments");
  if (session.user.authMethod !== "password")
    throw new ApiError(
      403,
      "Entre com o e-mail e a senha da direção para registrar uma decisão. A demonstração permite somente acompanhar."
    );
  const parsed = z
    .object({
      version: z.number().int().positive(),
      action: z.enum(["APPROVED", "REJECTED"]),
      feedback: z.string().trim().min(1, "Explique a decisão para a família.").max(2000),
    })
    .safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const id = await idOf(ctx);
  const result = await decidePlacement(
    id,
    parsed.data.version,
    parsed.data.action,
    parsed.data.feedback,
    session.user.id
  );
  await audit({
    userId: session.user.id,
    action: "REVIEW_PLACEMENT",
    entity: "PreEnrollment",
    entityId: id,
    payload: { status: parsed.data.action, version: parsed.data.version },
  });
  return NextResponse.json(result);
});
