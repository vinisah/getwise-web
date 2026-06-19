import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as searchGET } from "@/app/api/search/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const P = prisma as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>;

function req(q: string): NextRequest {
  return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(q)}`);
}

beforeEach(() => {
  P.user.findMany.mockResolvedValue([]);
  P.course.findMany.mockResolvedValue([]);
  P.lesson.findMany.mockResolvedValue([]);
  P.plan.findMany.mockResolvedValue([]);
  P.employee.findMany.mockResolvedValue([]);
});

// getEffectiveUser usa getServerSession (mock) + cookies (stub vazio no setup) → eff = session user.
describe("GET /api/search role-scoping", () => {
  it("q<2 → vazio, sem consultar o banco", async () => {
    mockSession.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN" } } as never);
    const res = await searchGET(req("a"));
    expect((await res.json()).results).toEqual([]);
    expect(P.user.findMany).not.toHaveBeenCalled();
  });

  it("STUDENT só busca Course(isActive)+Lesson(bookings.some) — nunca User/Employee/Plan", async () => {
    mockSession.mockResolvedValueOnce({ user: { id: "s1", role: "STUDENT" } } as never);
    await searchGET(req("ingles"));
    expect(P.user.findMany).not.toHaveBeenCalled();
    expect(P.employee.findMany).not.toHaveBeenCalled();
    expect(P.plan.findMany).not.toHaveBeenCalled();
    expect(P.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
    expect(P.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bookings: { some: { studentId: "s1" } } }) })
    );
  });

  it("TEACHER só busca Lesson(teacherId) — nunca User/Course/Plan/Employee", async () => {
    mockSession.mockResolvedValueOnce({ user: { id: "t1", role: "TEACHER" } } as never);
    await searchGET(req("aula"));
    expect(P.user.findMany).not.toHaveBeenCalled();
    expect(P.course.findMany).not.toHaveBeenCalled();
    expect(P.plan.findMany).not.toHaveBeenCalled();
    expect(P.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teacherId: "t1" }) })
    );
  });

  it("ADMIN: aluno encontrado vira href /admin/students/:id", async () => {
    mockSession.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN" } } as never);
    P.user.findMany.mockResolvedValueOnce([{ id: "u1", name: "Aluno X", email: "x@x.com" }]);
    const res = await searchGET(req("aluno"));
    const d = await res.json();
    expect(d.results[0]).toMatchObject({ type: "Aluno", href: "/admin/students/u1" });
  });
});
