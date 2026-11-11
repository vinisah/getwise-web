import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireAdmin, requireRole } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

const adminSession = { user: { id: "u1", name: "Admin", email: "a@a.com", role: "ADMIN" as const } };
const teacherSession = { user: { id: "u2", name: "Prof", email: "t@t.com", role: "TEACHER" as const } };
const studentSession = { user: { id: "u3", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };

describe("requireAuth", () => {
  it("returns session when logged in", async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession as any);
    const session = await requireAuth();
    expect(session.user.id).toBe("u1");
  });

  it("throws ApiError(401) when not logged in", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAdmin", () => {
  it("nega acesso direto à API de outra seção", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { ...adminSession.user, profileSections: ["courses"] } } as any);
    await expect(requireAdmin("financial")).rejects.toMatchObject({ status: 403 });
  });

  it("permite a seção atribuída", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { ...adminSession.user, profileSections: ["financial"] } } as any);
    await expect(requireAdmin("financial")).resolves.toBeDefined();
  });

  it("perfil users não permite conceder privilégios de dono", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { ...adminSession.user, profileSections: ["users"] } } as any);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("rotas mistas também aplicam as seções ao administrador", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { ...adminSession.user, profileSections: ["courses"] } } as any);
    await expect(requireAuth("lessons")).rejects.toMatchObject({ status: 403 });
  });
  it("passes for ADMIN role", async () => {
    mockGetServerSession.mockResolvedValueOnce(adminSession as any);
    await expect(requireAdmin()).resolves.toBeDefined();
  });

  it("throws ApiError(403) for TEACHER", async () => {
    mockGetServerSession.mockResolvedValueOnce(teacherSession as any);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("throws ApiError(403) for STUDENT", async () => {
    mockGetServerSession.mockResolvedValueOnce(studentSession as any);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("throws ApiError(401) when not logged in", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireRole", () => {
  it("passes for correct role", async () => {
    mockGetServerSession.mockResolvedValueOnce(teacherSession as any);
    await expect(requireRole("TEACHER")).resolves.toBeDefined();
  });

  it("throws ApiError(403) for wrong role", async () => {
    mockGetServerSession.mockResolvedValueOnce(studentSession as any);
    await expect(requireRole("TEACHER")).rejects.toMatchObject({ status: 403 });
  });
});
