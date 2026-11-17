import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { applicantSession } from "@/lib/pre-enrollment/session";
import { prisma } from "@/lib/prisma";
import { ApplicationSchema, isMinor } from "@/lib/pre-enrollment/schema";
import { availableCourse, reviewApplication } from "@/lib/pre-enrollment/service";
import { audit } from "@/lib/audit";
const idOf = async (ctx: unknown) => (await (ctx as { params: Promise<{ id: string }> }).params).id;
export const GET = withErrorHandler(async (req, ctx) => {
  const admin = req.nextUrl.searchParams.get("scope") === "admin";
  const session = admin ? await requireAdmin("pre-enrollments") : await applicantSession();
  const entry = await prisma.preEnrollment.findFirst({
    where: { id: await idOf(ctx), ...(!admin ? { applicantId: session.user.id } : {}) },
    include: {
      schoolUnit: { select: { name: true } },
      course: { select: { title: true } },
      applicant: { select: { emailVerified: true } },
    },
  });
  if (!entry) throw new ApiError(404, "Solicitação não encontrada.");
  return NextResponse.json(entry);
});
export const POST = withErrorHandler(async (req, ctx) => {
  const session = await requireAdmin("pre-enrollments");
  const parsed = z
    .object({
      version: z.number().int(),
      action: z.enum(["CORRECTION", "APPROVED", "REJECTED"]),
      feedback: z.string().trim().max(2000),
    })
    .safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, "Confira a decisão e a mensagem para a família.");
  const id = await idOf(ctx);
  const result = await reviewApplication(
    id,
    parsed.data.version,
    parsed.data.action,
    parsed.data.feedback,
    session.user.id
  );
  await audit({
    userId: session.user.id,
    action: "REVIEW_PRE_ENROLLMENT",
    entity: "PreEnrollment",
    entityId: id,
    payload: { status: parsed.data.action },
  });
  return NextResponse.json(result);
});
export const PUT = withErrorHandler(async (req, ctx) => {
  const session = await applicantSession();
  const raw = await req.json();
  const parsed = ApplicationSchema.safeParse(raw.data);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Confira os campos indicados.",
        issues: parsed.error.issues.map((i) => ({ path: `data.${i.path.join(".")}`, message: i.message })),
      },
      { status: 400 }
    );
  if (!Number.isInteger(raw.version)) throw new ApiError(400, "Versão ausente.");
  const data = parsed.data;
  const email = isMinor(data.student.birthDate) ? data.guardian!.email : data.student.email;
  if (email !== session.user.email) throw new ApiError(400, "O e-mail de acesso deve continuar sendo o da sua conta.");
  await prisma.$transaction(async (tx) => {
    await availableCourse(tx, data);
    const changed = await tx.preEnrollment.updateMany({
      where: { id: await idOf(ctx), applicantId: session.user.id, version: raw.version, status: "CORRECTION" },
      data: {
        data: data as Prisma.InputJsonValue,
        studentCpf: data.student.cpf,
        studentName: data.student.name,
        schoolUnitId: data.schoolUnitId,
        courseId: data.courseId,
        status: "PENDING",
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new ApiError(409, "A solicitação mudou ou não está disponível para correção. Atualize o acompanhamento.");
  });
  return NextResponse.json({ ok: true });
});
