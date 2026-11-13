import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { Prisma } from "@prisma/client";
import { CohortInput, ResponseInput, assertAvailable, weeklyDates, overlaps } from "./rules";
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

type Slot = { id?: string; scheduledAt: Date; duration: number };

export async function assertStudentSlot(tx: Prisma.TransactionClient, studentId: string, target: Slot) {
  const bookings = await tx.lessonBooking.findMany({
    where: {
      studentId,
      status: { not: "CANCELLED" },
      lesson: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledAt: {
          gte: new Date(target.scheduledAt.getTime() - 180 * 60000),
          lt: new Date(target.scheduledAt.getTime() + target.duration * 60000),
        },
      },
    },
    include: { lesson: true },
  });
  if (bookings.some((b) => b.lessonId !== target.id && overlaps(b.lesson, target))) {
    throw new ApiError(409, "Você já tem uma aula neste horário");
  }
}

export async function assertTeacherSlot(tx: Prisma.TransactionClient, teacherId: string, target: Slot) {
  const teacher = await tx.user.findFirst({
    where: { id: teacherId, role: "TEACHER", isActive: true },
    select: { id: true },
  });
  if (!teacher) throw new ApiError(409, "Aula indisponível: professor inativo ou inválido");
  const lessons = await tx.lesson.findMany({
    where: {
      teacherId,
      status: { not: "CANCELLED" },
      scheduledAt: {
        gte: new Date(target.scheduledAt.getTime() - 180 * 60000),
        lt: new Date(target.scheduledAt.getTime() + target.duration * 60000),
      },
    },
  });
  if (lessons.some((lesson) => lesson.id !== target.id && overlaps(lesson, target))) {
    throw new ApiError(409, "O professor já tem aula neste horário");
  }
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
          include: {
            teacher: { select: { isActive: true, role: true } },
            _count: { select: { bookings: { where: { status: { not: "CANCELLED" } } } } },
          },
        },
      },
    });
    const existingBookings = await tx.lessonBooking.findMany({
      where: {
        studentId,
        status: { not: "CANCELLED" },
        lesson: {
          scheduledAt: { gt: new Date(Date.now() - 180 * 60000) },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
      },
      include: { lesson: true },
    });
    const available = cohorts.filter(
      (cohort) =>
        cohort._count.students < cohort.capacity &&
        cohort.lessons.length > 0 &&
        cohort.lessons.every((lesson) => {
          const alreadyBooked = existingBookings.some((booking) => booking.lessonId === lesson.id);
          const occupied = lesson._count.bookings - Number(alreadyBooked);
          const conflicting = existingBookings.some(
            (booking) =>
              booking.lessonId !== lesson.id &&
              booking.lesson.scheduledAt.getTime() < lesson.scheduledAt.getTime() + lesson.duration * 60000 &&
              booking.lesson.scheduledAt.getTime() + booking.lesson.duration * 60000 > lesson.scheduledAt.getTime()
          );
          return (
            occupied < lesson.maxStudents &&
            !conflicting &&
            lesson.level === profile.level &&
            lesson.teacher.isActive &&
            lesson.teacher.role === "TEACHER"
          );
        })
    );
    if (!available.length)
      throw new ApiError(409, "Nenhuma turma do nível do aluno tem vaga. Cadastre uma turma ou libere vagas.");
    const cohort = available[randomInt(available.length)];
    await tx.lessonBooking.createMany({
      data: cohort.lessons.map((l) => ({ lessonId: l.id, studentId })),
      skipDuplicates: true,
    });
    // Uma reserva antiga cancelada já ocupa a chave única: skipDuplicates não a reativa.
    await tx.lessonBooking.updateMany({
      where: { studentId, lessonId: { in: cohort.lessons.map((l) => l.id) }, status: "CANCELLED" },
      data: {
        status: "SCHEDULED",
        confirmation: "PENDING",
        absenceReason: null,
        attendance: null,
        rating: null,
        feedback: null,
        reminderSentAt: null,
      },
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
      if (!booking.student.studentProfile || booking.student.studentProfile.level !== booking.lesson.level) {
        throw new ApiError(409, "Escolha uma aula do mesmo nível");
      }
      const teacher = await tx.user.findFirst({
        where: { id: booking.lesson.teacherId, isActive: true, role: "TEACHER" },
        select: { id: true },
      });
      if (!teacher) throw new ApiError(409, "Aula indisponível: professor inativo ou inválido");
      await assertStudentSlot(tx, studentId, booking.lesson);
      if (booking.status === "CANCELLED") {
        const occupied = await tx.lessonBooking.count({
          where: { lessonId: booking.lessonId, status: { not: "CANCELLED" } },
        });
        if (occupied >= booking.lesson.maxStudents)
          throw new ApiError(409, "A vaga foi ocupada. Escolha outro horário.");
      }
      return tx.lessonBooking.update({
        where: { id: booking.id },
        data: { status: "SCHEDULED", confirmation: "CONFIRMED", absenceReason: null },
      });
    }
    if (booking.confirmation !== "DECLINED") throw new ApiError(409, "Justifique a ausência antes de remarcar");
    const target = await tx.lesson.findUnique({
      where: { id: input.lessonId },
      include: { teacher: { select: { isActive: true, role: true } } },
    });
    if (
      !target ||
      target.scheduledAt <= new Date() ||
      target.status !== "SCHEDULED" ||
      !target.cohortId ||
      !target.teacher.isActive ||
      target.teacher.role !== "TEACHER" ||
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
    const existingTarget = await tx.lessonBooking.findUnique({
      where: { lessonId_studentId: { lessonId: target.id, studentId } },
    });
    if (existingTarget && existingTarget.status !== "CANCELLED")
      throw new ApiError(409, "Você já está inscrito nesta aula");
    await assertStudentSlot(tx, studentId, target);
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
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { teacher: { select: { isActive: true, role: true } } },
    });
    if (
      !lesson ||
      !lesson.cohortId ||
      !lesson.teacher.isActive ||
      lesson.teacher.role !== "TEACHER" ||
      lesson.status !== "SCHEDULED" ||
      lesson.scheduledAt <= new Date() ||
      !end ||
      lesson.scheduledAt > end.scheduledAt
    )
      throw new ApiError(400, "Aula indisponível");
    const existing = await tx.lessonBooking.findUnique({ where: { lessonId_studentId: { lessonId, studentId } } });
    const count = await tx.lessonBooking.count({ where: { lessonId, status: { not: "CANCELLED" } } });
    try {
      assertAvailable(
        profile.level,
        lesson.level,
        lesson.maxStudents,
        count - Number(!!existing && existing.status !== "CANCELLED")
      );
    } catch (error) {
      throw new ApiError(409, (error as Error).message);
    }
    await assertStudentSlot(tx, studentId, lesson);
    return tx.lessonBooking.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      create: { lessonId, studentId, confirmation: "CONFIRMED" },
      update: { status: "SCHEDULED", confirmation: "CONFIRMED", absenceReason: null },
    });
  });
}
