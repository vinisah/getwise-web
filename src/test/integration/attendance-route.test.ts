import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as attendancePOST } from "@/app/api/lessons/[id]/attendance/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const admin = { user: { id: "a1", role: "ADMIN" as const, name: "A", email: "a@a.com" } };
const teacher = (id: string) => ({ user: { id, role: "TEACHER" as const, name: "T", email: "t@t.com" } });
const student = { user: { id: "s1", role: "STUDENT" as const, name: "S", email: "s@s.com" } };

const ctx = { params: Promise.resolve({ id: "L1" }) };
function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/lessons/L1/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const validBody = { entries: [{ studentId: "s1", attendance: true, rating: 5 }] };

beforeEach(() => {
  (mockPrisma.$transaction as any).mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma)
  );
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
  (mockPrisma.lessonBooking.updateMany as any).mockResolvedValue({ count: 1 });
});

describe("POST /api/lessons/[id]/attendance", () => {
  it("admin marca qualquer aula → 200", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    expect((await attendancePOST(req(validBody), ctx as any)).status).toBe(200);
  });

  it("professor dono → 200", async () => {
    mockSession.mockResolvedValueOnce(teacher("t1") as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    expect((await attendancePOST(req(validBody), ctx as any)).status).toBe(200);
  });

  it("professor NÃO dono → 403", async () => {
    mockSession.mockResolvedValueOnce(teacher("t2") as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    expect((await attendancePOST(req(validBody), ctx as any)).status).toBe(403);
  });

  it("aluno → 403 (antes de buscar a aula)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    expect((await attendancePOST(req(validBody), ctx as any)).status).toBe(403);
  });

  it("aula inexistente → 404", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce(null);
    expect((await attendancePOST(req(validBody), ctx as any)).status).toBe(404);
  });

  it("rating fora de 1-5 → 400", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    expect(
      (await attendancePOST(req({ entries: [{ studentId: "s1", attendance: true, rating: 6 }] }), ctx as any)).status
    ).toBe(400);
  });

  it("IDOR-safe: updateMany escopado por (lessonId, studentId)", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    await attendancePOST(req(validBody), ctx as any);
    expect(mockPrisma.lessonBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lessonId: "L1", studentId: "s1" } })
    );
  });
});
