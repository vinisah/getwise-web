import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/courses/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const admin = { user: { id: "a1", name: "Admin", email: "a@a.com", role: "ADMIN" as const } };
const student = { user: { id: "s1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };

function req(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/courses", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/courses", () => {
  it("401 sem sessão", async () => {
    mockSession.mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(401);
  });
  it("200 para aluno (read)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    (mockPrisma.course.findMany as any).mockResolvedValueOnce([]);
    expect((await GET(req())).status).toBe(200);
  });
});

describe("POST /api/courses", () => {
  it("403 para aluno (write admin-only)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    const res = await POST(req("POST", { title: "X", level: "A1" }));
    expect(res.status).toBe(403);
  });
  it("400 body inválido (nível faltando)", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    const res = await POST(req("POST", { title: "Curso" }));
    expect(res.status).toBe(400);
  });
  it("201 admin cria curso", async () => {
    mockSession.mockResolvedValueOnce(admin as any);
    (mockPrisma.course.create as any).mockResolvedValueOnce({ id: "c1", title: "Curso", level: "A1" });
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    const res = await POST(req("POST", { title: "Curso A1", level: "A1" }));
    expect(res.status).toBe(201);
  });
});
