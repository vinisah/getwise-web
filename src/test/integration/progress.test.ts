import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/progress/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const student = { user: { id: "s1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/progress (teste do negativo)", () => {
  it("400 body inválido", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    expect((await POST(req({}))).status).toBe(400);
  });

  it("403 quando unidade anterior não concluída (unlock sequencial)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    // unit u2 pertence ao curso c1
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({
      id: "ckunit200000000000000002",
      module: { courseId: "c1", course: { id: "c1", title: "Curso" } },
    });
    // sem prerequisitos
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([]);
    // ordem: u1 (order1), u2 (order2)
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([
      { order: 1, units: [{ id: "ckunit100000000000000001", order: 1 }, { id: "ckunit200000000000000002", order: 2 }] },
    ]);
    // nenhuma unidade concluída
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]);

    const res = await POST(req({ unitId: "ckunit200000000000000002" }));
    expect(res.status).toBe(403);
  });
});
