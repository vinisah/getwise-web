import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import AdminDashboard from "@/app/(dashboard)/admin/page";
import LessonsPage from "@/app/(dashboard)/admin/lessons/page";

vi.mock("@/lib/effective-user", () => ({
  getCachedSession: vi.fn(async () => ({ user: { id: "admin", role: "ADMIN" } })),
}));
vi.mock("@/app/(dashboard)/admin/lessons/lesson-actions", () => ({ LessonActions: () => null }));

beforeEach(() => {
  vi.mocked(prisma.user.count).mockResolvedValue(2);
  vi.mocked(prisma.enrollment.count).mockResolvedValue(0);
  vi.mocked(prisma.financialTransaction.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as never);
  vi.mocked(prisma.financialTransaction.findMany).mockResolvedValue([]);
  vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } } as never);
  vi.mocked(prisma.plan.findMany).mockResolvedValue([]);
  vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.employee.findMany).mockResolvedValue([]);
  vi.mocked(prisma.lesson.findMany).mockImplementation((query) => {
    // Simulate a lesson with one active seat and one cancelled reservation.
    // An unfiltered relation must expose both, reproducing the original bug.
    const relation = query?.include?.bookings;
    const filtered = typeof relation === "object" &&
      typeof relation.where?.status === "object" && relation.where.status.not === "CANCELLED";
    return Promise.resolve([{
      id: "lesson", title: "Conversação", teacher: { name: "Mentor" },
      scheduledAt: new Date("2026-11-18T22:00:00Z"), duration: 50,
      maxStudents: 8, level: "A1", status: "SCHEDULED", meetingUrl: null,
      bookings: filtered ? [{ id: "active" }] : [{ id: "active" }, { id: "cancelled" }],
    }]) as unknown as ReturnType<typeof prisma.lesson.findMany>;
  });
});

describe("Horário e ocupação das aulas administrativas", () => {
  it("shows only active seats and Brasilia time on the dashboard", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(await AdminDashboard());
    expect(container.textContent).toContain("1 aluno(s)");
    expect(container.textContent).not.toContain("2 aluno(s)");
    expect(container.textContent).toContain("18/11/2026, 19:00");
  });

  it("uses the same active seat count and time in the lesson list", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(await LessonsPage({ searchParams: Promise.resolve({}) }));
    const row = container.querySelector("tbody tr")!;
    expect(row.textContent).toContain("1/8");
    expect(row.textContent).not.toContain("2/8");
    expect(row.textContent).toContain("18/11/2026, 19:00");
  });
});
