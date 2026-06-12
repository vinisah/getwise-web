import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/financial/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const adminSession = {
  user: { id: "admin-1", name: "Admin", email: "a@a.com", role: "ADMIN" as const },
};
const studentSession = {
  user: { id: "s-1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const },
};

function req(method = "GET", body?: unknown, search = ""): NextRequest {
  return new NextRequest(`http://localhost/api/financial${search}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/financial", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 403 for STUDENT", async () => {
    mockSession.mockResolvedValueOnce(studentSession as any);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns transactions for ADMIN", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.financialTransaction.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.financialTransaction.groupBy as any).mockResolvedValueOnce([]);
    const res = await GET(req());
    expect(res.status).toBe(200);
  });
});

describe("POST /api/financial", () => {
  const validBody = {
    type: "INCOME",
    amount: 500,
    description: "Mensalidade",
    date: "2026-06-01",
  };

  it("returns 400 for invalid amount (negative)", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    const res = await POST(req("POST", { ...validBody, amount: -100 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for amount over limit", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    const res = await POST(req("POST", { ...validBody, amount: 2_000_000 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing description", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    const res = await POST(req("POST", { ...validBody, description: "" }));
    expect(res.status).toBe(400);
  });

  it("creates transaction for valid ADMIN request", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.financialTransaction.create as any).mockResolvedValueOnce({
      id: "t1",
      ...validBody,
      isPaid: false,
    });
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
  });
});
