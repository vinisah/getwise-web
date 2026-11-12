import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as lessonPATCH, DELETE as lessonDELETE } from "@/app/api/lessons/[id]/route";
import { POST as lessonPOST } from "@/app/api/lessons/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma, true);

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
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1", status: "SCHEDULED" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "COMPLETED" });
    (mockPrisma.lessonBooking.findMany as any).mockResolvedValueOnce([]); // conclusão → busca bookings p/ XP
    const res = await lessonPATCH(req({ status: "COMPLETED" }), ctx as any);
    expect(res.status).toBe(200);
    // cascateia bookings não cancelados p/ COMPLETED
    expect(mockPrisma.lessonBooking.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "L1", status: { not: "CANCELLED" } },
      data: { status: "COMPLETED" },
    });
  });

  it("cancelar cascateia os bookings", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "CANCELLED" });
    (mockPrisma.lessonBooking.updateMany as any).mockResolvedValueOnce({ count: 2 });
    const res = await lessonPATCH(req({ status: "CANCELLED" }), ctx as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.lessonBooking.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "L1" },
      data: { status: "CANCELLED" },
    });
  });

  it("professor dono pode alterar a própria aula", async () => {
    mockSession.mockResolvedValueOnce(teacher("t1") as any);
    (mockPrisma.lesson.findUnique as any).mockResolvedValueOnce({ id: "L1", teacherId: "t1", status: "SCHEDULED" });
    (mockPrisma.lesson.update as any).mockResolvedValueOnce({ id: "L1", status: "COMPLETED" });
    (mockPrisma.lessonBooking.findMany as any).mockResolvedValueOnce([]);
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
    expect(mockPrisma.exercise.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "L1" },
      data: { lessonId: null },
    });
  });

  it("não-admin → 403", async () => {
    mockSession.mockResolvedValueOnce(teacher("t1") as any);
    const res = await lessonDELETE(delReq(), ctx as any);
    expect(res.status).toBe(403);
  });
});

describe("Criação e alteração manual respeitam a realocação", () => {
  const scheduledAt = new Date("2036-02-02T22:00:00Z");
  const current = { id: "L1", teacherId: "t1", status: "SCHEDULED", level: "A1", scheduledAt, duration: 50 };
  const create = {
    title: "Conversação",
    teacherId: "t1",
    scheduledAt: "2036-02-02T19:00",
    level: "A1",
    maxStudents: 2,
  };
  beforeEach(() => {
    mockSession.mockResolvedValue(admin as any);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "t1" } as never);
    mockPrisma.lesson.findMany.mockResolvedValue([]);
    mockPrisma.lessonBooking.findMany.mockResolvedValue([]);
    mockPrisma.lesson.findUnique.mockResolvedValue(current as never);
    mockPrisma.lesson.update.mockResolvedValue(current as never);
  });

  it("recusa aula nova com alunos além da capacidade", async () => {
    const response = await lessonPOST(req({ ...create, maxStudents: 1, studentIds: ["s1", "s2"] }));
    expect(response.status).toBe(409);
    expect(mockPrisma.lesson.create).not.toHaveBeenCalled();
  });

  it("recusa colisão do professor na criação", async () => {
    mockPrisma.lesson.findMany.mockResolvedValueOnce([{ ...current, id: "other" }] as never);
    const response = await lessonPOST(req(create));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("professor");
    expect(mockPrisma.lesson.create).not.toHaveBeenCalled();
  });

  it("recusa aluno de outro nível na criação", async () => {
    mockPrisma.user.count.mockResolvedValueOnce(0);
    const response = await lessonPOST(req({ ...create, studentIds: ["s1"] }));
    expect(response.status).toBe(400);
    expect(mockPrisma.lesson.create).not.toHaveBeenCalled();
  });

  it("recusa conflito de um participante ao mover a aula", async () => {
    mockPrisma.lessonBooking.findMany
      .mockResolvedValueOnce([{ studentId: "s1" }] as never)
      .mockResolvedValueOnce([
        { lessonId: "other", lesson: { ...current, scheduledAt: new Date("2036-02-03T22:20:00Z") } },
      ] as never);
    const response = await lessonPATCH(req({ scheduledAt: "2036-02-03T19:00" }), ctx);
    expect(response.status).toBe(409);
    expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
  });

  it("mudar o horário usa Brasília e exige nova confirmação dos participantes", async () => {
    const response = await lessonPATCH(req({ scheduledAt: "2036-02-03T19:00" }), ctx);
    expect(response.status).toBe(200);
    expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
      where: { id: "L1" },
      data: { scheduledAt: new Date("2036-02-03T22:00:00Z") },
    });
    expect(mockPrisma.lessonBooking.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "L1", status: { not: "CANCELLED" } },
      data: { confirmation: "PENDING", reminderSentAt: null },
    });
  });
});
