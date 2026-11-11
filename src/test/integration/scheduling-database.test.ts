// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.unmock("@/lib/prisma");
import { prisma } from "@/lib/prisma";
import { assignStudent, bookAdditionalLesson, createCohort, respond } from "@/lib/scheduling/service";

const enabled = process.env.RUN_SCHEDULING_DATABASE_TESTS === "1";
const ids: string[] = [];
const cohorts: string[] = [];
describe.skipIf(!enabled)("Agenda com PostgreSQL real", () => {
  it("respeita nível, turma fixa, remarcação e concorrência pela última vaga", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/getwise_feature") throw new Error("Banco de teste local obrigatório");
    const suffix = randomUUID();
    const teacher = await prisma.user.create({ data: { name: "Mentor teste", email: suffix + "@teacher.test", role: "TEACHER" } });
    ids.push(teacher.id);
    const students = await Promise.all([0,1,2].map((index) => prisma.user.create({ data: { name: "Aluno teste", email: suffix + index + "@student.test", role: "STUDENT", studentProfile: { create: { level: "A3" } } } })));
    ids.push(...students.map((s) => s.id));
    const start = new Date("2035-01-02T19:00:00-03:00");
    const source = await createCohort({ name: suffix, level: "A3", teacherId: teacher.id, capacity: 3, title: "Teste", startsAt: start.toISOString(), weeks: 4, duration: 50 });
    cohorts.push(source.id);
    for (const student of students) await assignStudent(student.id);
    const target = await createCohort({ name: suffix + " extra", level: "A3", teacherId: teacher.id, capacity: 1, title: "Outra aula", startsAt: new Date(start.getTime() + 86400000).toISOString(), weeks: 1, duration: 50 });
    cohorts.push(target.id);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { cohortId: target.id } });
    const attempts = await Promise.allSettled(students.slice(0,2).map((s) => bookAdditionalLesson(s.id, lesson.id)));
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.lessonBooking.count({ where: { lessonId: lesson.id, status: { not: "CANCELLED" } } })).toBe(1);
    const booking = await prisma.lessonBooking.findFirstOrThrow({ where: { studentId: students[2].id, lesson: { cohortId: source.id } } });
    await respond(students[2].id, { action: "decline", bookingId: booking.id, reason: "Compromisso" });
    await expect(respond(students[2].id, { action: "reschedule", bookingId: booking.id, lessonId: lesson.id })).rejects.toThrow("lotada");
    const freeTarget = await createCohort({ name: suffix + " disponível", level: "A3", teacherId: teacher.id, capacity: 3, title: "Nova aula", startsAt: new Date(start.getTime() + 2 * 86400000).toISOString(), weeks: 1, duration: 50 });
    cohorts.push(freeTarget.id);
    const freeLesson = await prisma.lesson.findFirstOrThrow({ where: { cohortId: freeTarget.id } });
    await respond(students[2].id, { action: "reschedule", bookingId: booking.id, lessonId: freeLesson.id });
    expect((await prisma.studentProfile.findUniqueOrThrow({ where: { userId: students[2].id } })).cohortId).toBe(source.id);
    expect((await prisma.lessonBooking.findUniqueOrThrow({ where: { id: booking.id } })).confirmation).toBe("RESCHEDULED");
    await expect(respond(students[2].id, { action: "reschedule", bookingId: booking.id, lessonId: freeLesson.id })).rejects.toThrow("já foi remarcada");
    const wrong = await createCohort({ name: suffix + " A2", level: "A2", teacherId: teacher.id, capacity: 3, title: "A2", startsAt: new Date(start.getTime() + 3 * 86400000).toISOString(), weeks: 1, duration: 50 });
    cohorts.push(wrong.id);
    const wrongLesson = await prisma.lesson.findFirstOrThrow({ where: { cohortId: wrong.id } });
    await expect(bookAdditionalLesson(students[2].id, wrongLesson.id)).rejects.toThrow("mesmo nível");
  }, 60000);
});
afterAll(async () => {
  if (!enabled) return;
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.cohort.deleteMany({ where: { id: { in: cohorts } } });
  await prisma.$disconnect();
});
