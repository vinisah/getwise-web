import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as lessonPATCH, DELETE as lessonDELETE } from "@/app/api/lessons/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const admin = { user: { id: "a1", role: "ADMIN" as const, name: "A", email: "a@a.com" } };
const teacher = (id: string) => ({ user: { id, role: "TEACHER" as const, name: "T", email: "t@t.com" } });
const student = { user: { id: "s1", role: "STUDENT" as const, name: "S", email: "s@s.com" } };

const ctx = { params: Promise.resolve({ id: "L1" }) };
function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/lessons/L1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  (mockPrisma.$transaction as any).mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma)
  );
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
});

describe("PATCH /api/lessons/[id]", () => {
  it("admin conclui a aula", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "COMPLETED" });
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(200);
  });

  it("cancelar cascateia os bookings", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "CANCELLED" });
    (mockPrisma.lessonBooking.updateMany as any).mockResolvedValueOnce({ count: 2 });
    const res = await lessonPATCH(req({ status: "CANCELLED" }), ctx as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.lessonBooking.updateMany).toHaveBeenCalledWith({ where: { lessonId: "L1" }, data: { status: "CANCELLED" } });
  });

  it("professor dono pode alterar a própria aula", async () => {
    mockSession.mockResolvedValueOnce(teacher("t1") as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "COMPLETED" });
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(200);
  });

  it("professor NÃO dono → 403", async () => {
    mockSession.mockResolvedValueOnce(teacher("t2") as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(403);
  });

  it("aluno → 403 (antes mesmo de buscar a aula)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(403);
  });

  it("404 quando a aula não existe", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce(null);
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/lessons/[id]", () => {
  function delReq(): NextRequest {
    return new NextRequest("http://localhost/api/lessons/L1", { method: "DELETE" });
  }

  it("admin remove aula: desvincula exercícios + apaga bookings (evita P2003)", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1" });
    (mockPrisma.exercise.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.lessonBooking.deleteMany as any).mockResolvedValueOnce({ count: 2 });
    (mockPrisma.lesson.delete as any).mockResolvedValueOnce({ id: "L1" });
    const res = await lessonDELETE(delReq(), ctx as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.exercise.updateMany).toHaveBeenCalledWith({ where: { lessonId: "L1" }, data: { lessonId: null } });
  });

  it("não-admin → 403", async () => {
    mockSession.mockResolvedValueOnce(teacher("t1") as any);
    const res = await lessonDELETE(delReq(), ctx as any);
    expect(res.status).toBe(403);
  });
});
