import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/exercises/attempt/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const student = { user: { id: "s1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/exercises/attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/exercises/attempt (submit + grading)", () => {
  it("400 body inválido", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    expect((await POST(req({}))).status).toBe(400);
  });

  it("501 para tipo stub (pronúncia)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({
      id: "ckp1", type: "PRONUNCIATION", correctAnswer: "x", points: 10, unitId: null,
    });
    const res = await POST(req({ exerciseId: "ckp1", answer: "x" }));
    expect(res.status).toBe(501);
  });

  it("200 MC correto → passed + best-score", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({
      id: "ckmc1", type: "MULTIPLE_CHOICE", correctAnswer: "Ay", points: 10, unitId: null, explanation: null,
    });
    (mockPrisma.exerciseAttempt.create as any).mockResolvedValueOnce({ id: "at1" });
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    (mockPrisma.exerciseAttempt.aggregate as any).mockResolvedValueOnce({ _max: { scorePercent: 100 } });

    const res = await POST(req({ exerciseId: "ckmc1", answer: "Ay" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.passed).toBe(true);
    expect(data.bestScorePercent).toBe(100);
  });

  it("200 MC errado → não passou", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.exercise.findUnique as any).mockResolvedValueOnce({
      id: "ckmc2", type: "MULTIPLE_CHOICE", correctAnswer: "Ay", points: 10, unitId: null, explanation: null,
    });
    (mockPrisma.exerciseAttempt.create as any).mockResolvedValueOnce({ id: "at2" });
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    (mockPrisma.exerciseAttempt.aggregate as any).mockResolvedValueOnce({ _max: { scorePercent: 0 } });

    const res = await POST(req({ exerciseId: "ckmc2", answer: "Bee" }));
    const data = await res.json();
    expect(data.passed).toBe(false);
  });
});
