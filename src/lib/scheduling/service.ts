import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { Prisma } from "@prisma/client";
import { CohortInput, ResponseInput, assertAvailable, weeklyDates } from "./rules";
import type { z } from "zod";

export async function schedulingTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(742191)");
      return operation(tx);
    },
    { timeout: 20000 }
  );
}

export async function createCohort(input: z.infer<typeof CohortInput>) {
  if (new Date(input.startsAt) <= new Date()) throw new ApiError(400, "Escolha uma data futura");
  return schedulingTransaction(async (tx) => {
    const teacher = await tx.user.findFirst({ where: { id: input.teacherId, role: "TEACHER", isActive: true } });
    if (!teacher) throw new ApiError(400, "Professor inválido");
    const dates = weeklyDates(input.startsAt, input.weeks);
    const others = await tx.lesson.findMany({
      where: {
        teacherId: teacher.id,
        status: { not: "CANCELLED" },
        scheduledAt: {
          gte: new Date(dates[0].getTime() - 180 * 60000),
          lt: new Date(dates[dates.length - 1].getTime() + input.duration * 60000),
        },
      },
    });
    if (
      dates.some((date) =>
        others.some(
          (lesson) =>
            lesson.scheduledAt.getTime() < date.getTime() + input.duration * 60000 &&
            lesson.scheduledAt.getTime() + lesson.duration * 60000 > date.getTime()
        )
      )
    ) {
      throw new ApiError(409, "O professor já tem aula neste horário");
    }
    return tx.cohort.create({
      data: {
        name: input.name,
        level: input.level,
        capacity: input.capacity,
        lessons: {
          create: dates.map((scheduledAt) => ({
            teacherId: teacher.id,
            title: input.title,
            scheduledAt,
            duration: input.duration,
            level: input.level,
            maxStudents: input.capacity,
          })),
        },
      },
    });
  });
}

export async function assignStudent(studentId: string, transaction?: Prisma.TransactionClient) {
  const operation = async (tx: Prisma.TransactionClient) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId: studentId }, include: { user: true } });
    if (!profile || !profile.user.isActive || profile.user.role !== "STUDENT")
      throw new ApiError(400, "Aluno inválido");
    if (profile.cohortId) return profile;
    const cohorts = await tx.cohort.findMany({
      where: { level: profile.level },
      include: {
        _count: { select: { students: true } },
        lessons: {
          where: { scheduledAt: { gt: new Date() }, status: "SCHEDULED" },
          include: { _count: { select: { bookings: { where: { status: { not: "CANCELLED" } } } } } },
        },
      },
    });
    const available = cohorts.filter(
      (c) =>
        c._count.students < c.capacity && c.lessons.length && c.lessons.every((l) => l._count.bookings < l.maxStudents)
    );
    if (!available.length)
      throw new ApiError(409, "Nenhuma turma do nível do aluno tem vaga. Cadastre uma turma ou libere vagas.");
    const cohort = available[randomInt(available.length)];
    await tx.lessonBooking.createMany({
      data: cohort.lessons.map((l) => ({ lessonId: l.id, studentId })),
      skipDuplicates: true,
    });
    return tx.studentProfile.update({ where: { userId: studentId }, data: { cohortId: cohort.id } });
  };
  return transaction ? operation(transaction) : schedulingTransaction(operation);
}

export async function respond(studentId: string, input: z.infer<typeof ResponseInput>) {
  return schedulingTransaction(async (tx) => {
    const booking = await tx.lessonBooking.findFirst({
      where: { id: input.bookingId, studentId },
      include: { lesson: true, student: { select: { studentProfile: true } } },
    });
    if (!booking) throw new ApiError(404, "Reserva não encontrada");
    if (booking.lesson.scheduledAt <= new Date() || booking.lesson.status !== "SCHEDULED")
      throw new ApiError(409, "Esta aula já começou ou foi encerrada");
    if (booking.confirmation === "RESCHEDULED") throw new ApiError(409, "Esta aula já foi remarcada");
    if (input.action === "decline") {
      return tx.lessonBooking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", confirmation: "DECLINED", absenceReason: input.reason },
      });
    }
    if (input.action === "confirm") {
      if (booking.status === "CANCELLED") {
        const occupied = await tx.lessonBooking.count({
          where: { lessonId: booking.lessonId, status: { not: "CANCELLED" } },
        });
        if (occupied >= booking.lesson.maxStudents)
          throw new ApiError(409, "A vaga foi ocupada. Escolha outro horário.");
      }
      return tx.lessonBooking.update({
        where: { id: booking.id },
        data: { status: "SCHEDULED", confirmation: "CONFIRMED" },
      });
    }
    if (booking.confirmation !== "DECLINED") throw new ApiError(409, "Justifique a ausência antes de remarcar");
    const target = await tx.lesson.findUnique({ where: { id: input.lessonId } });
    if (
      !target ||
      target.scheduledAt <= new Date() ||
      target.status !== "SCHEDULED" ||
      !target.cohortId ||
      target.id === booking.lessonId
    )
      throw new ApiError(400, "Aula indisponível");
    const profile = booking.student.studentProfile;
    const courseEnd = profile?.cohortId
      ? await tx.lesson.findFirst({ where: { cohortId: profile.cohortId }, orderBy: { scheduledAt: "desc" } })
      : null;
    if (!profile || !courseEnd || target.scheduledAt > courseEnd.scheduledAt)
      throw new ApiError(400, "Aula fora do período do curso");
    const occupied = await tx.lessonBooking.count({ where: { lessonId: target.id, status: { not: "CANCELLED" } } });
    try {
      assertAvailable(profile.level, target.level, target.maxStudents, occupied);
    } catch (error) {
      throw new ApiError(409, (error as Error).message);
    }
    const overlaps = await tx.lessonBooking.findMany({
      where: {
        studentId,
        status: { not: "CANCELLED" },
        lesson: {
          status: "SCHEDULED",
          scheduledAt: {
            lt: new Date(target.scheduledAt.getTime() + target.duration * 60000),
            gte: new Date(target.scheduledAt.getTime() - 180 * 60000),
          },
        },
      },
      include: { lesson: true },
    });
    if (overlaps.some((b) => b.lesson.scheduledAt.getTime() + b.lesson.duration * 60000 > target.scheduledAt.getTime()))
      throw new ApiError(409, "Você já tem uma aula neste horário");
    await tx.lessonBooking.upsert({
      where: { lessonId_studentId: { lessonId: target.id, studentId } },
      create: { lessonId: target.id, studentId, confirmation: "CONFIRMED" },
      update: { status: "SCHEDULED", confirmation: "CONFIRMED", absenceReason: null },
    });
    return tx.lessonBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", confirmation: "RESCHEDULED" },
    });
  });
}

export async function bookAdditionalLesson(studentId: string, lessonId: string) {
  return schedulingTransaction(async (tx) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId: studentId } });
    if (!profile?.cohortId) throw new ApiError(409, "A equipe precisa definir sua turma");
    const end = await tx.lesson.findFirst({ where: { cohortId: profile.cohortId }, orderBy: { scheduledAt: "desc" } });
    const lesson = await tx.lesson.findUnique({ where: { id: lessonId } });
    if (
      !lesson ||
      !lesson.cohortId ||
      lesson.status !== "SCHEDULED" ||
      lesson.scheduledAt <= new Date() ||
      !end ||
      lesson.scheduledAt > end.scheduledAt
    )
      throw new ApiError(400, "Aula indisponível");
    const existing = await tx.lessonBooking.findUnique({ where: { lessonId_studentId: { lessonId, studentId } } });
    if (existing && existing.status !== "CANCELLED") return existing;
    const count = await tx.lessonBooking.count({ where: { lessonId, status: { not: "CANCELLED" } } });
    try {
      assertAvailable(profile.level, lesson.level, lesson.maxStudents, count);
    } catch (error) {
      throw new ApiError(409, (error as Error).message);
    }
    const bookings = await tx.lessonBooking.findMany({
      where: { studentId, status: { not: "CANCELLED" }, lesson: { status: "SCHEDULED" } },
      include: { lesson: true },
    });
    if (
      bookings.some(
        (b) =>
          b.lesson.scheduledAt.getTime() < lesson.scheduledAt.getTime() + lesson.duration * 60000 &&
          b.lesson.scheduledAt.getTime() + b.lesson.duration * 60000 > lesson.scheduledAt.getTime()
      )
    )
      throw new ApiError(409, "Você já tem aula neste horário");
    return tx.lessonBooking.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      create: { lessonId, studentId, confirmation: "CONFIRMED" },
      update: { status: "SCHEDULED", confirmation: "CONFIRMED" },
    });
  });
}
