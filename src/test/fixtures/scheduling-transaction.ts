import { vi } from "vitest";

/** Transação com uma turma A1 disponível para testes dos dois cadastros. */
export function createSchedulingTransactionFixture<T>(user: T, userId: string) {
  return {
    user,
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    studentProfile: {
      findUnique: vi.fn().mockResolvedValue({
        userId,
        level: "A1",
        cohortId: null,
        user: { role: "STUDENT", isActive: true },
      }),
      update: vi.fn().mockResolvedValue({ cohortId: "cohort-1" }),
    },
    cohort: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "cohort-1",
          capacity: 8,
          _count: { students: 1 },
          lessons: [
            {
              id: "lesson-1",
              level: "A1",
              teacher: { isActive: true, role: "TEACHER" },
              maxStudents: 8,
              _count: { bookings: 1 },
            },
          ],
        },
      ]),
    },
    lessonBooking: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}
