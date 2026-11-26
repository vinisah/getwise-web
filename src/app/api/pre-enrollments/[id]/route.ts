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
import { assertPlacement, placementBinding, openUnit, requireDirectorInDatabase } from "@/lib/pre-enrollment/placement";
import { lookupResidence } from "@/lib/pre-enrollment/location";
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
      placementRequests: {
        orderBy: { applicationVersion: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          reason: true,
          feedback: true,
          snapshot: true,
          applicationVersion: true,
          reviewedAt: true,
          binding: true,
        },
      },
    },
  });
  if (!entry) throw new ApiError(404, "Solicitação não encontrada.");
  let canDecidePlacement = false;
  if (admin && session.user.authMethod === "password") {
    try {
      await requireDirectorInDatabase(prisma, session.user.id);
      canDecidePlacement = true;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 403) throw e;
    }
  }
  return NextResponse.json({ ...entry, canDecidePlacement });
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
  const residence = await lookupResidence(data.student.zipCode);
  const id = await idOf(ctx);
  await prisma.$transaction(
    async (tx) => {
      const entry = await tx.preEnrollment.findFirst({ where: { id, applicantId: session.user.id } });
      if (!entry) throw new ApiError(404, "Solicitação não encontrada.");
      if (
        entry.version !== raw.version ||
        !["CORRECTION", "PLACEMENT_PENDING", "PLACEMENT_AUTHORIZED", "PLACEMENT_REJECTED"].includes(entry.status)
      )
        throw new ApiError(409, "A solicitação mudou. Atualize o acompanhamento.");
      await assertPlacement(tx, data, residence, id);
      const unit = await openUnit(tx, data.schoolUnitId);
      await tx.placementRequest.updateMany({
        where: {
          applicationId: id,
          status: { in: ["PENDING", "APPROVED"] },
          binding: { not: placementBinding(data, residence, unit) },
        },
        data: { status: "SUPERSEDED" },
      });
      await availableCourse(tx, data);
      const changed = await tx.preEnrollment.updateMany({
        where: { id, applicantId: session.user.id, version: raw.version, status: entry.status },
        data: {
          data: data as Prisma.InputJsonValue,
          studentCpf: data.student.cpf,
          studentName: data.student.name,
          schoolUnitId: data.schoolUnitId,
          courseId: data.courseId,
          status: "PENDING",
          geographyRequired: true,
          residence,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ApiError(409, "A solicitação mudou ou não está disponível para correção. Atualize o acompanhamento.");
    },
    { isolationLevel: "Serializable" }
  );
  return NextResponse.json({ ok: true });
});
