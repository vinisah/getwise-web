import { describe, it, expect } from "vitest";
import { studentFrequency, teacherClassFrequency, teacherAvgRating } from "@/lib/services/attendance";
import { prisma } from "@/lib/prisma";

const lb = prisma.lessonBooking as unknown as {
  findMany: ReturnType<typeof import("vitest").vi.fn>;
  aggregate: ReturnType<typeof import("vitest").vi.fn>;
};
const lesson = prisma.lesson as unknown as { findMany: ReturnType<typeof import("vitest").vi.fn> };

describe("studentFrequency", () => {
  it("calcula % de presença sobre aulas marcadas", async () => {
    lb.findMany.mockResolvedValueOnce([{ attendance: true }, { attendance: true }, { attendance: false }]);
    expect(await studentFrequency("s1")).toEqual({ marked: 3, attended: 2, percent: 67 });
  });

  it("sem marcação → percent null", async () => {
    lb.findMany.mockResolvedValueOnce([]);
    expect(await studentFrequency("s1")).toEqual({ marked: 0, attended: 0, percent: null });
  });
});

describe("teacherClassFrequency", () => {
  it("% por aula concluída, ignorando bookings não marcados", async () => {
    lesson.findMany.mockResolvedValueOnce([
      { id: "l1", title: "A", bookings: [{ attendance: true }, { attendance: false }, { attendance: null }] },
      { id: "l2", title: "B", bookings: [{ attendance: null }] },
    ]);
    const res = await teacherClassFrequency("t1");
    expect(res[0]).toEqual({ lessonId: "l1", title: "A", total: 2, attended: 1, percent: 50 });
    expect(res[1]).toEqual({ lessonId: "l2", title: "B", total: 0, attended: 0, percent: null });
  });
});

describe("teacherAvgRating", () => {
  it("retorna média + contagem", async () => {
    lb.aggregate.mockResolvedValueOnce({ _avg: { rating: 4.5 }, _count: { rating: 8 } });
    expect(await teacherAvgRating("t1")).toEqual({ avg: 4.5, count: 8 });
  });
});
