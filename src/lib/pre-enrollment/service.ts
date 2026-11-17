import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { createToken, expiresIn } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { ApplicationData, isMinor } from "./schema";

export async function availableCourse(tx: Prisma.TransactionClient, data: ApplicationData) {
  const unit = await tx.schoolUnit.findUnique({
    where: { id: data.schoolUnitId },
    include: { courses: { where: { courseId: data.courseId }, include: { course: true } } },
  });
  if (!unit?.isActive || !unit.enrollmentOpen || !unit.courses[0]?.course.isActive)
    throw new ApiError(409, "Unidade ou curso indisponível. Volte à seleção e escolha uma opção disponível.");
  return unit;
}
export async function sendVerification(email: string) {
  const token = createToken();
  await prisma.emailVerificationToken.create({ data: { email, token, expires: expiresIn(24) } });
  try {
    await sendVerificationEmail(email, token);
    return true;
  } catch {
    return false;
  }
}
export async function submitApplication(data: ApplicationData, password: string, requestId: string) {
  const owner = isMinor(data.student.birthDate) ? data.guardian! : data.student;
  const existing = await prisma.user.findUnique({ where: { email: owner.email }, omit: { password: false } });
  if (existing && (!existing.isActive || !existing.password || !(await bcrypt.compare(password, existing.password))))
    throw new ApiError(409, "Esse e-mail já possui acesso. Use a senha da conta ou recupere-a na tela de login.");
  const hashed = existing ? undefined : await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    await availableCourse(tx, data);
    const repeated = await tx.preEnrollment.findUnique({ where: { requestId } });
    if (repeated) {
      if (!existing || repeated.applicantId !== existing.id)
        throw new ApiError(409, "Não foi possível repetir este envio.");
      return { application: repeated, user: existing };
    }
    const duplicate = await tx.preEnrollment.findUnique({
      where: {
        studentCpf_courseId_schoolUnitId: {
          studentCpf: data.student.cpf,
          courseId: data.courseId,
          schoolUnitId: data.schoolUnitId,
        },
      },
    });
    if (duplicate)
      throw new ApiError(
        409,
        "Já existe uma solicitação para este aluno, curso e unidade. Entre para acompanhar ou corrigir a solicitação existente."
      );
    const user =
      existing ??
      (await tx.user.create({
        data: { name: owner.name, email: owner.email, phone: owner.phone, password: hashed, role: "APPLICANT" },
      }));
    const application = await tx.preEnrollment.create({
      data: {
        requestId,
        protocol: `GW-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        applicantId: user.id,
        schoolUnitId: data.schoolUnitId,
        courseId: data.courseId,
        studentCpf: data.student.cpf,
        studentName: data.student.name,
        data: {
          ...data,
          guardian: isMinor(data.student.birthDate) ? data.guardian : null,
          allergyDetails: data.allergies === "YES" ? data.allergyDetails : "",
        } as Prisma.InputJsonValue,
      },
    });
    return { application, user };
  });
  const emailVerified = !!result.user.emailVerified;
  const emailSent = emailVerified ? false : await sendVerification(owner.email);
  return { ok: true, protocol: result.application.protocol, emailSent, emailVerified };
}
export async function reviewApplication(
  id: string,
  version: number,
  action: string,
  feedback: string,
  reviewerId: string
) {
  return prisma.$transaction(
    async (tx) => {
      const entry = await tx.preEnrollment.findUnique({ where: { id }, include: { applicant: true, course: true } });
      if (!entry) throw new ApiError(404, "Pré-matrícula não encontrada.");
      if (entry.version !== version || !["PENDING", "CORRECTION"].includes(entry.status))
        throw new ApiError(409, "Esta solicitação mudou. Atualize a página antes de continuar.");
      if (action !== "APPROVED" && !feedback.trim()) throw new ApiError(400, "Explique a decisão para a família.");
      if (action === "APPROVED" && !entry.applicant.emailVerified)
        throw new ApiError(409, "A família precisa confirmar o e-mail antes da aprovação.");
      const data = entry.data as unknown as ApplicationData;
      let studentId = entry.studentId;
      if (action === "APPROVED") {
        await availableCourse(tx, data);
        const profile = await tx.studentProfile.findUnique({ where: { cpf: data.student.cpf } });
        if (profile) studentId = profile.userId;
        else {
          // O identificador interno da criança não é um endereço de contato.
          const student =
            !isMinor(data.student.birthDate) && entry.applicant.role === "APPLICANT"
              ? await tx.user.update({
                  where: { id: entry.applicantId },
                  data: { role: "STUDENT", name: data.student.name, phone: data.student.phone },
                })
              : await tx.user.create({
                  data: {
                    name: data.student.name,
                    email: `${randomUUID()}@students.getwise.invalid`,
                    phone: data.student.phone,
                    role: "STUDENT",
                  },
                });
          studentId = student.id;
          await tx.studentProfile.create({
            data: {
              userId: studentId,
              cpf: data.student.cpf,
              birthDate: new Date(`${data.student.birthDate}T12:00:00Z`),
              address: `${data.student.address}, ${data.student.number} — ${data.student.neighborhood}`,
              zipCode: data.student.zipCode,
              level: entry.course.level,
              emergencyContact: data.guardian ? `${data.guardian.name} — ${data.guardian.phone}` : null,
            },
          });
        }
      }
      const changed = await tx.preEnrollment.updateMany({
        where: { id, version },
        data: {
          status: action,
          feedback,
          studentId,
          version: { increment: 1 },
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ApiError(409, "A solicitação foi atualizada por outra pessoa.");
      return { ok: true, studentId };
    },
    { isolationLevel: "Serializable" }
  );
}
