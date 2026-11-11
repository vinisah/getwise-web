import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/students/route";
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

function req(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/students", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/students", () => {
  it("returns 401 when not logged in", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 403 for STUDENT role", async () => {
    mockSession.mockResolvedValueOnce(studentSession as any);
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns students list for ADMIN", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.user.findMany as any).mockResolvedValueOnce([
      { id: "s1", name: "Aluno A", email: "a@b.com", role: "STUDENT" },
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("POST /api/students", () => {
  it("returns 401 when not logged in", async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(req("POST", { name: "X", email: "x@x.com", password: "pass123" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockSession.mockResolvedValueOnce(studentSession as any);
    const res = await POST(req("POST", { name: "X", email: "x@x.com", password: "pass123" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    const res = await POST(req("POST", { name: "X" })); // missing email + password
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 409 for duplicate email", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "existing" });
    const res = await POST(req("POST", { name: "Test", email: "dup@dup.com", password: "pass123" }));
    expect(res.status).toBe(409);
  });

  it("creates student and returns 201 for admin", async () => {
    mockSession.mockResolvedValueOnce(adminSession as any);
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce(null);
    (mockPrisma.user.create as any).mockResolvedValueOnce({
      id: "new-1",
      name: "Novo Aluno",
      email: "novo@test.com",
      role: "STUDENT",
    });
    const transaction = {
      user: mockPrisma.user,
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      studentProfile: {
        findUnique: vi.fn().mockResolvedValue({ userId: "new-1", level: "A1", cohortId: null, user: { role: "STUDENT", isActive: true } }),
        update: vi.fn().mockResolvedValue({ cohortId: "cohort-1" }),
      },
      cohort: { findMany: vi.fn().mockResolvedValue([{ id: "cohort-1", capacity: 8, _count: { students: 1 }, lessons: [{ id: "lesson-1", maxStudents: 8, _count: { bookings: 1 } }] }]) },
      lessonBooking: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    (mockPrisma.$transaction as any).mockImplementationOnce((callback: any) => callback(transaction));
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    const res = await POST(req("POST", { name: "Novo Aluno", email: "novo@test.com", password: "pass123" }));
    expect(res.status).toBe(201);
    expect(transaction.lessonBooking.createMany).toHaveBeenCalled();
  });
});
