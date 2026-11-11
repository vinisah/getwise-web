import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { withErrorHandler } from "@/lib/api-error";
import { safeAuditPayload } from "@/lib/audit-payload";
import { GET as financial } from "@/app/api/financial/route";
import { PATCH as updateUser } from "@/app/api/users/[id]/route";
import { GET as lessons } from "@/app/api/lessons/route";
import { GET as search } from "@/app/api/search/route";
import { getEffectiveUser } from "@/lib/effective-user";
import { sendPasswordResetEmail } from "@/lib/email";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";

const session = vi.mocked(getServerSession);

describe("segurança e minimização de dados", () => {
  it("API financeira bloqueia perfil de cursos antes de consultar dados", async () => {
    session.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN", profileSections: ["courses"] } } as never);
    const res = await financial(new NextRequest("http://localhost/api/financial"));
    expect(res.status).toBe(403);
    expect(prisma.financialTransaction.findMany).not.toHaveBeenCalled();
  });

  it("admin delegado não remove o próprio perfil para virar dono", async () => {
    session.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN", profileSections: ["users"] } } as never);
    const res = await updateUser(new NextRequest("http://localhost/api/users/a1", {
      method: "PATCH", body: JSON.stringify({ profileId: null }),
    }), { params: Promise.resolve({ id: "a1" }) });
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("cookie de preview forjado não amplia privilégios de perfil restrito", async () => {
    session.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN", profileSections: ["courses"] } } as never);
    vi.mocked(cookies).mockResolvedValueOnce({ get: () => ({ value: "victim" }) } as never);
    expect(await getEffectiveUser()).toMatchObject({ id: "a1", isPreview: false });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("busca administrativa não consulta dados de seções negadas", async () => {
    session.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN", profileSections: ["courses"] } } as never);
    vi.mocked(prisma.course.findMany).mockResolvedValueOnce([]);
    const res = await search(new NextRequest("http://localhost/api/search?q=ana"));
    expect(res.status).toBe(200);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.lesson.findMany).not.toHaveBeenCalled();
  });

  it("aluno só recebe a própria reserva e DTOs mínimos de participantes", async () => {
    session.mockResolvedValueOnce({ user: { id: "student1", role: "STUDENT" } } as never);
    vi.mocked(prisma.lesson.findMany).mockResolvedValueOnce([]);
    const res = await lessons(new NextRequest("http://localhost/api/lessons"));
    expect(res.status).toBe(200);
    expect(prisma.lesson.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bookings: { some: { studentId: "student1" } } }),
      omit: { notes: true },
      include: expect.objectContaining({
        teacher: { select: { id: true, name: true, image: true } },
        bookings: { where: { studentId: "student1" }, include: { student: { select: { id: true, name: true } } } },
        exercises: { omit: { correctAnswer: true, explanation: true } },
      }),
    }));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it.each(["https://attacker.example", "null", "http://localhost.attacker.example"])("nega escrita de origem %s", async (origin) => {
    const mutation = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withErrorHandler(mutation)(new NextRequest("http://localhost/api/me/prefs", {
      method: "POST", headers: { origin, cookie: "session=demo" },
    }));
    expect(res.status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("permite escrita da mesma origem e webhook autenticável sem cookie", async () => {
    const handler = withErrorHandler(async () => NextResponse.json({ ok: true }));
    const same = await handler(new NextRequest("http://localhost/api/me/prefs", {
      method: "PATCH", headers: { origin: "http://localhost", cookie: "session=demo" },
    }));
    expect(same.status).toBe(200);
    const webhook = await handler(new NextRequest("http://localhost/api/webhooks/asaas", { method: "POST" }));
    expect(webhook.status).toBe(200);
  });

  it("erros não expõem dados do driver nem no modo de desenvolvimento", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await withErrorHandler(async () => { throw new Error("cpf=123 password=secret"); })(new NextRequest("http://localhost/api/test"));
      expect(await res.json()).toEqual({ error: "Erro interno do servidor" });
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    } finally { log.mockRestore(); vi.unstubAllEnvs(); }
  });

  it("auditoria descarta credenciais, texto livre e objetos pessoais", () => {
    expect(safeAuditPayload({ status: "PAID", count: 1, password: "secret", email: "x@y.test", content: "conversa", nested: { cpf: "123" }, errors: ["cpf=123"] })).toEqual({ status: "PAID", count: 1 });
  });

  it("sem SMTP não simula entrega nem imprime link de recuperação", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(sendPasswordResetEmail("private@example.test", "secret-token")).rejects.toThrow("não configurado");
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); vi.unstubAllEnvs(); }
  });

  it("falha de SMTP não revela se a conta existe na recuperação", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const request = () => new NextRequest("http://localhost/api/auth/forgot-password", {
        method: "POST", body: JSON.stringify({ email: "private@example.test" }),
        headers: { "content-type": "application/json", "x-real-ip": "192.0.2.55" },
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "u1" } as never);
      vi.mocked(prisma.passwordResetToken.create).mockResolvedValueOnce({} as never);
      const existing = await forgotPassword(request());
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      const missing = await forgotPassword(request());
      expect(existing.status).toBe(200);
      expect(missing.status).toBe(existing.status);
      expect(await existing.json()).toEqual(await missing.json());
      expect(JSON.stringify(log.mock.calls)).not.toContain("private@example.test");
    } finally { log.mockRestore(); vi.unstubAllEnvs(); }
  });
});
