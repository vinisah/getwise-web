import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH as userPATCH } from "@/app/api/users/[id]/route";
import { POST as adjustPOST } from "@/app/api/plans/adjust/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const adminSession = { user: { id: "admin-1", name: "Admin", email: "a@a.com", role: "ADMIN" as const } };
const studentSession = { user: { id: "s-1", name: "Aluno", email: "s@s.com", role: "STUDENT" as const } };

function req(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  mockSession.mockResolvedValue(adminSession as any);
  // $transaction: aceita callback interativo E array de promises.
  (mockPrisma.$transaction as any).mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma)
  );
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
});

describe("PATCH /api/users/[id]", () => {
  const ctxOther = { params: Promise.resolve({ id: "u-2" }) };
  const ctxSelf = { params: Promise.resolve({ id: "admin-1" }) };

  it("admin troca role de outro membro da equipe", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "u-2", role: "ADMIN" });
    (mockPrisma.user.update as any).mockResolvedValueOnce({ id: "u-2", role: "TEACHER", isActive: true });

    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { role: "TEACHER" }), ctxOther as any);
    expect(res.status).toBe(200);
    expect((mockPrisma.user.update as any).mock.calls[0][0].data.role).toBe("TEACHER");
  });

  it("admin NÃO rebaixa a si mesmo (anti-lockout)", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "admin-1", role: "ADMIN" });
    const res = await userPATCH(
      req("http://localhost/api/users/admin-1", "PATCH", { role: "TEACHER" }),
      ctxSelf as any
    );
    expect(res.status).toBe(400);
  });

  it("admin NÃO desativa a si mesmo", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "admin-1", role: "ADMIN" });
    const res = await userPATCH(
      req("http://localhost/api/users/admin-1", "PATCH", { isActive: false }),
      ctxSelf as any
    );
    expect(res.status).toBe(400);
  });

  it("senha temporária é hasheada (nunca texto plano)", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "u-2", role: "TEACHER" });
    (mockPrisma.user.update as any).mockResolvedValueOnce({ id: "u-2" });

    await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { password: "nova123" }), ctxOther as any);
    const stored = (mockPrisma.user.update as any).mock.calls[0][0].data.password;
    expect(stored).not.toBe("nova123");
    expect(stored).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  it("STUDENT não acessa (403)", async () => {
    mockSession.mockResolvedValueOnce(studentSession as any);
    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { role: "ADMIN" }), ctxOther as any);
    expect(res.status).toBe(403);
  });

  it("corpo vazio → 400", async () => {
    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", {}), ctxOther as any);
    expect(res.status).toBe(400);
  });

  it("admin NÃO aplica perfil restrito a si mesmo (anti-lockout)", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "admin-1", role: "ADMIN" });
    const res = await userPATCH(
      req("http://localhost/api/users/admin-1", "PATCH", { profileId: "p1" }),
      ctxSelf as any
    );
    expect(res.status).toBe(400);
  });

  it("perfil inexistente → 400", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "u-2", role: "ADMIN" });
    (mockPrisma.accessProfile.findUnique as any).mockResolvedValueOnce(null);
    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { profileId: "nope" }), ctxOther as any);
    expect(res.status).toBe(400);
  });

  it("atribui perfil válido a outro usuário → 200", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "u-2", role: "ADMIN" });
    (mockPrisma.accessProfile.findUnique as any).mockResolvedValueOnce({ id: "p1" });
    (mockPrisma.user.update as any).mockResolvedValueOnce({ id: "u-2" });
    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { profileId: "p1" }), ctxOther as any);
    expect(res.status).toBe(200);
    expect((mockPrisma.user.update as any).mock.calls[0][0].data.profileId).toBe("p1");
  });

  it("demoção de ADMIN limpa o profileId (evita perfil stale numa re-promoção)", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "u-2", role: "ADMIN" });
    (mockPrisma.user.update as any).mockResolvedValueOnce({ id: "u-2", role: "TEACHER" });
    const res = await userPATCH(req("http://localhost/api/users/u-2", "PATCH", { role: "TEACHER" }), ctxOther as any);
    expect(res.status).toBe(200);
    expect((mockPrisma.user.update as any).mock.calls[0][0].data.profileId).toBeNull();
  });
});

describe("POST /api/plans/adjust", () => {
  it("reajusta todos os planos ativos pelo percentual", async () => {
    (mockPrisma.plan.findMany as any).mockResolvedValueOnce([
      { id: "p1", name: "Basic", price: 39700 },
      { id: "p2", name: "Premium", price: 79700 },
    ]);
    (mockPrisma.plan.update as any)
      .mockResolvedValueOnce({ id: "p1", name: "Basic", price: 42876 })
      .mockResolvedValueOnce({ id: "p2", name: "Premium", price: 86076 });

    const res = await adjustPOST(req("http://localhost/api/plans/adjust", "POST", { percent: 8 }));

    expect(res.status).toBe(200);
    const calls = (mockPrisma.plan.update as any).mock.calls;
    expect(calls[0][0].data.price).toBe(42876); // 39700×1,08
    expect(calls[1][0].data.price).toBe(86076); // 79700×1,08
  });

  it("rejeita percentual fora do limite", async () => {
    const res = await adjustPOST(req("http://localhost/api/plans/adjust", "POST", { percent: 150 }));
    expect(res.status).toBe(400);
  });
});
