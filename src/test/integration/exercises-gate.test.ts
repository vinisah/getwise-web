import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as exercisesGET } from "@/app/api/exercises/route";
import { POST as attemptPOST } from "@/app/api/exercises/attempt/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const student = { user: { id: "s1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };
const admin = { user: { id: "a1", name: "Admin", email: "a@a.com", role: "ADMIN" as const } };

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/exercises/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
});

describe("GET /api/exercises — strip de gabarito para aluno", () => {
  it("STUDENT NÃO recebe correctAnswer/explanation", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.studentProfile.findUnique as any).mockResolvedValueOnce({ level: "A1" });
    (mockPrisma.exercise.findMany as any).mockResolvedValueOnce([
      { id: "e1", title: "Ex", level: "A1", type: "MULTIPLE_CHOICE", content: {}, correctAnswer: "B", explanation: "pq B", points: 10 },
    ]);
    const res = await exercisesGET(new NextRequest("http://localhost/api/exercises"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe("e1");
    expect("correctAnswer" in data[0]).toBe(false);
    expect("explanation" in data[0]).toBe(false);
  });

  it("ADMIN recebe o gabarito completo", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.exercise.findMany as any).mockResolvedValueOnce([
      { id: "e1", title: "Ex", level: "A1", type: "MULTIPLE_CHOICE", content: {}, correctAnswer: "B", explanation: "pq B", points: 10 },
    ]);
    const res = await exercisesGET(new NextRequest("http://localhost/api/exercises"));
    const data = await res.json();
    expect("correctAnswer" in data[0]).toBe(true);
  });
});

describe("POST /api/exercises/attempt — política de revelação", () => {
  const agg = { _max: { scorePercent: 0 } };

  it("prática pura (sem unidade) errada → revela gabarito (feedback didático)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({ id: "e1", type: "MULTIPLE_CHOICE", correctAnswer: "B", explanation: "pq B", points: 10, unitId: null });
    (mockPrisma.exerciseAttempt.create as any).mockResolvedValueOnce({ id: "att1" });
    (mockPrisma.exerciseAttempt.aggregate as any).mockResolvedValueOnce(agg);

    const res = await attemptPOST(postReq({ exerciseId: "e1", answer: "Z" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.passed).toBe(false);
    expect("correctAnswer" in data).toBe(true);
  });

  it("exercício de UNIDADE errado (unidade acessível) → NÃO revela gabarito", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({ id: "e2", type: "MULTIPLE_CHOICE", correctAnswer: "B", explanation: "pq B", points: 10, unitId: "u1" });
    // canAccessUnit("s1","u1") → true
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c1", course: { isActive: true } } });
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([{ order: 0, units: [{ id: "u1", order: 0 }] }]);
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.exerciseAttempt.create as any).mockResolvedValueOnce({ id: "att2" });
    (mockPrisma.exerciseAttempt.aggregate as any).mockResolvedValueOnce(agg);

    const res = await attemptPOST(postReq({ exerciseId: "e2", answer: "Z" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.passed).toBe(false);
    expect("correctAnswer" in data).toBe(false);
  });

  it("exercício de UNIDADE bloqueada → 403 (não cria tentativa)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({ id: "e3", type: "MULTIPLE_CHOICE", correctAnswer: "B", points: 10, unitId: "u9" });
    // canAccessUnit → false (pré-req sem certificado)
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c2", course: { isActive: true } } });
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([{ requiredCourseId: "c1" }]);
    (mockPrisma.certificate.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]);

    const res = await attemptPOST(postReq({ exerciseId: "e3", answer: "Z" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.exerciseAttempt.create).not.toHaveBeenCalled();
  });
});
