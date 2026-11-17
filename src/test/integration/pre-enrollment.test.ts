import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET as list } from "@/app/api/pre-enrollments/route";
import { GET as detail, POST as review } from "@/app/api/pre-enrollments/[id]/route";
import { GET as catalog } from "@/app/api/auth/enrollment-catalog/route";
import { POST as submit } from "@/app/api/auth/register/route";
import { requireAuth } from "@/lib/api-auth";
import { availableCourse } from "@/lib/pre-enrollment/service";
import { adultApplication } from "@/test/fixtures/pre-enrollment";
vi.mock("@/lib/pre-enrollment/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/pre-enrollment/service")>();
  return {
    ...original,
    submitApplication: vi.fn().mockResolvedValue({ ok: true, protocol: "GW-TEST", emailSent: false }),
  };
});
const session = vi.mocked(getServerSession);
const ctx = { params: Promise.resolve({ id: "entry-1" }) };
beforeEach(() => {
  vi.mocked(prisma.preEnrollment.findMany).mockResolvedValue([]);
  vi.mocked(prisma.preEnrollment.count).mockResolvedValue(0);
});
describe("pré-matrícula: validação e permissões", () => {
  it("não aceita o cadastro antigo que alocava aluno automaticamente", async () => {
    const r = await submit(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "João", email: "j@example.test", password: "senha123" }),
      })
    );
    expect(r.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("recebe ficha válida e comunica falha de email sem perder o envio", async () => {
    const r = await submit(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          data: adultApplication,
          password: "senha123",
          requestId: "50edacb7-b066-4d37-9327-6c744c97e981",
        }),
      })
    );
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ ok: true, emailSent: false });
  });
  it("lista somente solicitações da própria conta", async () => {
    session.mockResolvedValueOnce({ user: { id: "family-1", role: "APPLICANT" } } as never);
    const r = await list(new NextRequest("http://localhost/api/pre-enrollments"));
    expect(r.status).toBe(200);
    expect(prisma.preEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { applicantId: "family-1" }, take: 20 })
    );
  });
  it("não encontra dados de outra família", async () => {
    session.mockResolvedValueOnce({ user: { id: "family-2", role: "APPLICANT" } } as never);
    vi.mocked(prisma.preEnrollment.findFirst).mockResolvedValueOnce(null);
    const r = await detail(new NextRequest("http://localhost/api/pre-enrollments/entry-1"), ctx);
    expect(r.status).toBe(404);
    expect(prisma.preEnrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "entry-1", applicantId: "family-2" } })
    );
  });
  it("pré-matriculado não acessa operações acadêmicas antigas", async () => {
    session.mockResolvedValueOnce({ user: { id: "family-1", role: "APPLICANT" } } as never);
    await expect(requireAuth()).rejects.toMatchObject({ status: 403 });
  });
  it("perfil de cursos não lê fichas de pré-matrícula", async () => {
    session.mockResolvedValueOnce({ user: { id: "staff", role: "ADMIN", profileSections: ["courses"] } } as never);
    const r = await list(new NextRequest("http://localhost/api/pre-enrollments?scope=admin"));
    expect(r.status).toBe(403);
    expect(prisma.preEnrollment.findMany).not.toHaveBeenCalled();
  });
  it("aluno não toma decisão administrativa", async () => {
    session.mockResolvedValueOnce({ user: { id: "s", role: "STUDENT" } } as never);
    const r = await review(
      new NextRequest("http://localhost/api/pre-enrollments/entry-1", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVED", version: 1, feedback: "" }),
      }),
      ctx
    );
    expect(r.status).toBe(403);
  });
  it("catálogo público seleciona só campos necessários", async () => {
    vi.mocked(prisma.schoolUnit.findMany).mockResolvedValueOnce([]);
    const r = await catalog(new NextRequest("http://localhost/api/auth/enrollment-catalog"));
    expect(r.status).toBe(200);
    const query = vi.mocked(prisma.schoolUnit.findMany).mock.calls[0][0];
    expect(query).toMatchObject({ where: { isActive: true, enrollmentOpen: true } });
    expect(query?.select).not.toHaveProperty("partners");
    expect(query?.select).not.toHaveProperty("cnpj");
  });
  it("revalida curso e unidade ao enviar", async () => {
    const tx = {
      schoolUnit: { findUnique: vi.fn().mockResolvedValue({ isActive: true, enrollmentOpen: true, courses: [] }) },
    };
    await expect(availableCourse(tx as never, adultApplication)).rejects.toMatchObject({ status: 409 });
  });
});
