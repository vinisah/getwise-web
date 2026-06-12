/**
 * Smoke tests — verificam que rotas respondem corretamente sem estado de banco.
 * Fixture gradiente: anônimo, admin, student.
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const adminSession = {
  user: { id: "admin-1", name: "Admin", email: "a@a.com", role: "ADMIN" as const },
};

// Fixture: anônimo → sempre 401 em rotas protegidas
async function expectUnauth(handler: (req: NextRequest) => Promise<Response>, url: string) {
  mockSession.mockResolvedValueOnce(null);
  const res = await handler(new NextRequest(url, { method: "GET" }));
  expect(res.status).toBe(401);
}

describe("Smoke — rotas protegidas retornam 401 para anônimo", () => {
  it("GET /api/students → 401", async () => {
    const { GET } = await import("@/app/api/students/route");
    await expectUnauth(GET!, "http://localhost/api/students");
  });

  it("GET /api/financial → 401", async () => {
    const { GET } = await import("@/app/api/financial/route");
    await expectUnauth(GET!, "http://localhost/api/financial");
  });

  it("GET /api/enrollments → 401", async () => {
    const { GET } = await import("@/app/api/enrollments/route");
    await expectUnauth(GET!, "http://localhost/api/enrollments");
  });

  it("GET /api/employees → 401", async () => {
    const { GET } = await import("@/app/api/employees/route");
    await expectUnauth(GET!, "http://localhost/api/employees");
  });

  it("GET /api/lessons → 401", async () => {
    const { GET } = await import("@/app/api/lessons/route");
    await expectUnauth(GET!, "http://localhost/api/lessons");
  });
});

describe("Smoke — admin pode acessar rotas protegidas", () => {
  it("GET /api/students → 200 for admin", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.user.findMany as any).mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/students/route");
    const res = await GET!(new NextRequest("http://localhost/api/students", { method: "GET" }));
    expect(res.status).toBe(200);
  });

  it("GET /api/plans → 200 for admin", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.plan.findMany as any).mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/plans/route");
    const res = await GET!(new NextRequest("http://localhost/api/plans", { method: "GET" }));
    expect(res.status).toBe(200);
  });
});
