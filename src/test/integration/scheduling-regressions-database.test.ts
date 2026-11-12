// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.unmock("@/lib/prisma");
import { prisma } from "@/lib/prisma";
import { bookAdditionalLesson, respond } from "@/lib/scheduling/service";

const enabled = process.env.RUN_SCHEDULING_DATABASE_TESTS === "1";
const users: string[] = [];
const cohorts: string[] = [];
let databaseVerified = false;

async function scenario() {
  const suffix = randomUUID();
  const teacher = await prisma.user.create({
    data: { name: "Revisão agenda", email: `${suffix}@teacher.test`, role: "TEACHER" },
  });
  users.push(teacher.id);
  const cohort = await prisma.cohort.create({ data: { name: suffix, level: "A1", capacity: 4 } });
  cohorts.push(cohort.id);
  const student = await prisma.user.create({
    data: {
      name: "Revisão aluno",
      email: `${suffix}@student.test`,
      role: "STUDENT",
      studentProfile: { create: { level: "A1", cohortId: cohort.id } },
    },
  });
  users.push(student.id);
  const lesson = (scheduledAt: string) =>
    prisma.lesson.create({
      data: {
        teacherId: teacher.id,
        cohortId: cohort.id,
        title: "Revisão",
        level: "A1",
        maxStudents: 4,
        duration: 50,
        scheduledAt: new Date(scheduledAt),
      },
    });
  const source = await lesson("2036-02-02T19:00:00-03:00");
  const overlap = await lesson("2036-02-02T19:20:00-03:00");
  const end = await lesson("2036-02-23T19:00:00-03:00");
  const booking = await prisma.lessonBooking.create({ data: { studentId: student.id, lessonId: source.id } });
  return { student, teacher, cohort, source, overlap, end, booking };
}

describe.skipIf(!enabled)("Regressões da realocação com PostgreSQL", { timeout: 30000 }, () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/getwise_feature")
      throw new Error("Banco de teste local obrigatório");
    databaseVerified = true;
  });

  it("não reconfirma a origem se outra reserva passou a ocupar o mesmo horário", async () => {
    const s = await scenario();
    await respond(s.student.id, { action: "decline", bookingId: s.booking.id, reason: "Compromisso" });
    await bookAdditionalLesson(s.student.id, s.overlap.id);
    await expect(respond(s.student.id, { action: "confirm", bookingId: s.booking.id })).rejects.toThrow("horário");
    expect((await prisma.lessonBooking.findUniqueOrThrow({ where: { id: s.booking.id } })).status).toBe("CANCELLED");
  });

  it("reconfirmar limpa a justificativa de ausência anterior", async () => {
    const s = await scenario();
    await respond(s.student.id, { action: "decline", bookingId: s.booking.id, reason: "Compromisso cancelado" });
    await respond(s.student.id, { action: "confirm", bookingId: s.booking.id });
    expect(await prisma.lessonBooking.findUniqueOrThrow({ where: { id: s.booking.id } })).toMatchObject({
      confirmation: "CONFIRMED",
      absenceReason: null,
    });
  });

  it("voltar à aula pelo botão Participar também limpa a justificativa", async () => {
    const s = await scenario();
    await respond(s.student.id, { action: "decline", bookingId: s.booking.id, reason: "Compromisso cancelado" });
    await bookAdditionalLesson(s.student.id, s.source.id);
    expect(await prisma.lessonBooking.findUniqueOrThrow({ where: { id: s.booking.id } })).toMatchObject({
      confirmation: "CONFIRMED",
      absenceReason: null,
    });
  });

  it("impede confirmar aula cujo nível mudou depois da reserva", async () => {
    const s = await scenario();
    await prisma.studentProfile.update({ where: { userId: s.student.id }, data: { level: "A2" } });
    await expect(respond(s.student.id, { action: "confirm", bookingId: s.booking.id })).rejects.toThrow("nível");
  });

  it("professor inativo não recebe novas reservas", async () => {
    const s = await scenario();
    await prisma.user.update({ where: { id: s.teacher.id }, data: { isActive: false } });
    await expect(bookAdditionalLesson(s.student.id, s.end.id)).rejects.toThrow("indisponível");
  });

  it("uma resposta atrasada não toma a vaga ocupada por outro aluno", async () => {
    const s = await scenario();
    await respond(s.student.id, { action: "decline", bookingId: s.booking.id, reason: "Trabalho" });
    await prisma.lesson.update({ where: { id: s.source.id }, data: { maxStudents: 1 } });
    const other = await prisma.user.create({
      data: { name: "Revisão aluno", email: `${randomUUID()}@student.test`, role: "STUDENT" },
    });
    users.push(other.id);
    await prisma.lessonBooking.create({ data: { studentId: other.id, lessonId: s.source.id } });
    await expect(respond(s.student.id, { action: "confirm", bookingId: s.booking.id })).rejects.toThrow(
      "vaga foi ocupada"
    );
    expect(await prisma.lessonBooking.count({ where: { lessonId: s.source.id, status: { not: "CANCELLED" } } })).toBe(
      1
    );
  });

  it("aula em andamento bloqueia horário sobreposto e permite a seguinte", async () => {
    const s = await scenario();
    await prisma.lesson.update({ where: { id: s.source.id }, data: { status: "IN_PROGRESS" } });
    await expect(bookAdditionalLesson(s.student.id, s.overlap.id)).rejects.toThrow("horário");
    await prisma.lesson.update({
      where: { id: s.overlap.id },
      data: { scheduledAt: new Date(s.source.scheduledAt.getTime() + s.source.duration * 60000) },
    });
    await expect(bookAdditionalLesson(s.student.id, s.overlap.id)).resolves.toMatchObject({
      confirmation: "CONFIRMED",
    });
  });

  it("não consome uma remarcação para uma aula em que o aluno já está inscrito", async () => {
    const s = await scenario();
    await respond(s.student.id, { action: "decline", bookingId: s.booking.id, reason: "Trabalho" });
    await bookAdditionalLesson(s.student.id, s.end.id);
    await expect(
      respond(s.student.id, { action: "reschedule", bookingId: s.booking.id, lessonId: s.end.id })
    ).rejects.toThrow("já está inscrito");
    expect(await prisma.lessonBooking.findUniqueOrThrow({ where: { id: s.booking.id } })).toMatchObject({
      confirmation: "DECLINED",
    });
  });

  it("Participar sobre uma reserva existente confirma sem duplicar ou contar a própria vaga", async () => {
    const s = await scenario();
    await prisma.lesson.update({ where: { id: s.source.id }, data: { maxStudents: 1 } });
    await expect(bookAdditionalLesson(s.student.id, s.source.id)).resolves.toMatchObject({
      id: s.booking.id,
      confirmation: "CONFIRMED",
    });
    expect(await prisma.lessonBooking.count({ where: { lessonId: s.source.id } })).toBe(1);
  });
});

afterAll(async () => {
  if (!enabled || !databaseVerified) return;
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.cohort.deleteMany({ where: { id: { in: cohorts } } });
  await prisma.$disconnect();
});
