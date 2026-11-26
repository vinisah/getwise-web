import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { lookupResidence, municipalityKey, type Residence } from "./location";
import { placementDraft, type PlacementData } from "./placement-schema";
import type { ApplicationData } from "./schema";

const editable = ["PLACEMENT_PENDING", "PLACEMENT_REJECTED", "PLACEMENT_AUTHORIZED", "CORRECTION", "APPROVED"];
type BindingData = Pick<ApplicationData, "student" | "schoolUnitId">;
export function placementBinding(data: BindingData, residence: Residence, unit: { city: string; state: string }) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        data.student.cpf,
        data.student.name.trim(),
        data.student.birthDate,
        residence.zipCode,
        residence.municipalityCode,
        data.schoolUnitId,
        municipalityKey(unit.city, unit.state),
      ])
    )
    .digest("hex");
}
export async function openUnit(db: DbClient, id: string) {
  const unit = await db.schoolUnit.findUnique({
    where: { id },
    select: { id: true, name: true, city: true, state: true, isActive: true, enrollmentOpen: true },
  });
  if (!unit?.isActive || !unit.enrollmentOpen)
    throw new ApiError(409, "Unidade indisponível. Escolha outra unidade aberta.");
  return unit;
}
export async function assertPlacement(
  db: DbClient,
  data: ApplicationData,
  residence: Residence,
  applicationId?: string
) {
  const unit = await openUnit(db, data.schoolUnitId);
  if (municipalityKey(residence.city, residence.state) === municipalityKey(unit.city, unit.state)) return;
  const binding = placementBinding(data, residence, unit);
  // Only the latest request of THIS application can grant permission. A sibling, old
  // revision, or a client-supplied authorization cannot satisfy this check.
  const latest = applicationId
    ? await db.placementRequest.findFirst({ where: { applicationId }, orderBy: { applicationVersion: "desc" } })
    : null;
  if (!latest || latest.status !== "APPROVED" || latest.binding !== binding)
    throw new ApiError(
      409,
      "Esta unidade fica em outra cidade. Solicite a análise da direção para este aluno, CEP e unidade antes de enviar."
    );
}
export async function requireDirectorInDatabase(db: DbClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, isSchoolDirector: true, profile: { select: { sections: true } } },
  });
  if (
    !user?.isActive ||
    user.role !== "ADMIN" ||
    !user.isSchoolDirector ||
    (user.profile && !user.profile.sections.includes("pre-enrollments"))
  )
    throw new ApiError(403, "Somente a direção designada, com acesso às pré-matrículas, pode decidir este pedido.");
}
export async function requestPlacement(
  input: PlacementData,
  access:
    | { password: string; requestId: string }
    | { applicationId: string; applicantId: string; email: string; version: number }
) {
  const residence = await lookupResidence(input.student.zipCode);
  const editing = "applicationId" in access;
  const owner = editing
    ? null
    : await prisma.user.findUnique({ where: { email: input.contact.email }, omit: { password: false } });
  if (editing && input.contact.email !== access.email) throw new ApiError(400, "Mantenha o e-mail da sua conta.");
  if (
    !editing &&
    owner &&
    (!owner.isActive || !owner.password || !(await bcrypt.compare(access.password, owner.password)))
  )
    throw new ApiError(409, "Esse e-mail já possui acesso. Use a senha da conta ou recupere-a na tela de login.");
  const password = !editing && !owner ? await bcrypt.hash(access.password, 12) : undefined;
  return prisma.$transaction(
    async (tx) => {
      const unit = await openUnit(tx, input.schoolUnitId);
      if (municipalityKey(unit.city, unit.state) === municipalityKey(residence.city, residence.state))
        throw new ApiError(
          400,
          "Esta unidade fica na cidade do aluno. Continue com o formulário, sem solicitar exceção."
        );
      let application;
      if (editing) {
        const current = await tx.preEnrollment.findFirst({
          where: { id: access.applicationId, applicantId: access.applicantId },
        });
        if (!current) throw new ApiError(404, "Solicitação não encontrada.");
        if (current.version !== access.version || !editable.includes(current.status))
          throw new ApiError(409, "A solicitação mudou. Atualize o acompanhamento.");
        const previous = current.data as unknown as ApplicationData;
        const draft = placementDraft(input);
        const data = {
          ...previous,
          schoolUnitId: input.schoolUnitId,
          courseId: current.schoolUnitId === input.schoolUnitId ? previous.courseId : "",
          student: { ...previous.student, ...input.student, email: draft.student.email },
          guardian: draft.guardian
            ? { ...(previous.guardian ?? draft.guardian), name: input.contact.name, email: input.contact.email }
            : null,
        };
        const updated = await tx.preEnrollment.updateMany({
          where: { id: current.id, version: access.version },
          data: {
            data: data as Prisma.InputJsonValue,
            studentCpf: input.student.cpf,
            studentName: input.student.name,
            schoolUnitId: unit.id,
            courseId: data.courseId || null,
            residence,
            geographyRequired: true,
            status: "PLACEMENT_PENDING",
            feedback: "",
            version: { increment: 1 },
          },
        });
        if (!updated.count) throw new ApiError(409, "A solicitação foi atualizada. Recarregue a página.");
        application = { ...current, version: current.version + 1, data };
      } else {
        const repeated = await tx.preEnrollment.findUnique({ where: { requestId: access.requestId } });
        if (repeated) {
          if (!owner || repeated.applicantId !== owner.id)
            throw new ApiError(409, "Não foi possível repetir este envio.");
          return { id: repeated.id, protocol: repeated.protocol, status: repeated.status };
        }
        const user =
          owner ??
          (await tx.user.create({
            data: { name: input.contact.name, email: input.contact.email, password, role: "APPLICANT" },
          }));
        application = await tx.preEnrollment.create({
          data: {
            requestId: access.requestId,
            protocol: `GW-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
            applicantId: user.id,
            schoolUnitId: unit.id,
            courseId: null,
            studentCpf: input.student.cpf,
            studentName: input.student.name,
            data: placementDraft(input),
            residence,
            geographyRequired: true,
            status: "PLACEMENT_PENDING",
          },
        });
      }
      await tx.placementRequest.updateMany({
        where: { applicationId: application.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "SUPERSEDED" },
      });
      await tx.placementRequest.create({
        data: {
          applicationId: application.id,
          applicationVersion: application.version,
          binding: placementBinding(placementDraft(input), residence, unit),
          snapshot: {
            student: input.student,
            residence,
            unit: { id: unit.id, name: unit.name, city: unit.city, state: unit.state },
          },
          reason: input.reason,
        },
      });
      return { id: application.id, protocol: application.protocol, status: "PLACEMENT_PENDING" };
    },
    { isolationLevel: "Serializable" }
  );
}
export async function decidePlacement(
  id: string,
  version: number,
  action: "APPROVED" | "REJECTED",
  feedback: string,
  reviewerId: string
) {
  if (!feedback.trim()) throw new ApiError(400, "Explique a decisão para a família.");
  return prisma.$transaction(
    async (tx) => {
      await requireDirectorInDatabase(tx, reviewerId);
      const application = await tx.preEnrollment.findUnique({ where: { id } });
      if (!application) throw new ApiError(404, "Solicitação não encontrada.");
      if (application.version !== version || application.status !== "PLACEMENT_PENDING")
        throw new ApiError(409, "Este pedido mudou. Atualize antes de decidir.");
      const request = await tx.placementRequest.findUnique({
        where: { applicationId_applicationVersion: { applicationId: id, applicationVersion: version } },
      });
      if (!request || request.status !== "PENDING")
        throw new ApiError(409, "Os dados do pedido mudaram. A família precisa conferir a solicitação novamente.");
      if (action === "APPROVED") {
        const unit = await openUnit(tx, application.schoolUnitId);
        if (
          request.binding !==
          placementBinding(application.data as unknown as ApplicationData, application.residence as Residence, unit)
        )
          throw new ApiError(409, "Os dados do pedido mudaram. A família precisa conferir a solicitação novamente.");
      }
      await tx.placementRequest.update({
        where: { id: request.id },
        data: { status: action, feedback: feedback.trim(), reviewedBy: reviewerId, reviewedAt: new Date() },
      });
      const changed = await tx.preEnrollment.updateMany({
        where: { id, version, status: "PLACEMENT_PENDING" },
        data: {
          status: action === "APPROVED" ? "PLACEMENT_AUTHORIZED" : "PLACEMENT_REJECTED",
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw new ApiError(409, "Este pedido já recebeu uma decisão.");
      return { ok: true };
    },
    { isolationLevel: "Serializable" }
  );
}
