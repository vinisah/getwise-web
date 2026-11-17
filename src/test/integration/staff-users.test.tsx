import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/effective-user";
import { GET } from "@/app/api/users/route";
import { PATCH } from "@/app/api/users/[id]/route";
import UsersPage from "@/app/(dashboard)/admin/users/page";

vi.mock("@/lib/effective-user", () => ({ getCachedSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw Error("redirect");
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const admin = { user: { id: "owner", role: "ADMIN", profileSections: null } };
const rows = [
  { id: "owner", role: "ADMIN", name: "Dono interno", isActive: true, profile: null },
  { id: "staff", role: "ADMIN", name: "Atendente interno", isActive: false, profile: { name: "Secretaria" } },
  { id: "teacher", role: "TEACHER", name: "Professor interno", isActive: true, profile: null },
  { id: "student", role: "STUDENT", name: "Aluno externo", isActive: false, profile: null },
  { id: "family", role: "APPLICANT", name: "Responsável externo", isActive: true, profile: null },
].map((row) => ({
  ...row,
  email: `${row.id}@example.invalid`,
  profileId: row.profile ? "secretaria" : null,
  createdAt: new Date("2026-01-01"),
  emailVerified: null,
}));

// O mock respeita o filtro da consulta: sua remoção faz alunos/famílias vazarem no teste.
function matching(where: any) {
  return rows.filter(
    (row) =>
      (!where?.role?.in || where.role.in.includes(row.role)) &&
      (where?.isActive === undefined || row.isActive === where.isActive)
  );
}
beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(admin as never);
  vi.mocked(getCachedSession).mockResolvedValue(admin as never);
  vi.mocked(prisma.user.count).mockImplementation((async (query: any) => matching(query?.where).length) as never);
  vi.mocked(prisma.user.findMany).mockImplementation((async (query: any) =>
    matching(query?.where).slice(query?.skip ?? 0, (query?.skip ?? 0) + (query?.take ?? rows.length))) as never);
  vi.mocked(prisma.accessProfile.findMany).mockResolvedValue([{ id: "secretaria", name: "Secretaria" }] as never);
});

describe("Usuários: acessos exclusivos da equipe", () => {
  it("API inclui professores e funcionários inativos, sem alunos ou responsáveis", async () => {
    const res = await GET(new NextRequest("http://localhost/api/users"));
    expect(res.status).toBe(200);
    expect((await res.json()).map((u: any) => u.id)).toEqual(["owner", "staff", "teacher"]);
    expect(res.headers.get("X-Total-Count")).toBe("3");
    expect(res.headers.get("X-Page-Size")).toBe("20");
  });

  it("página e contadores exibem somente a equipe; mantém destinos separados", async () => {
    const html = renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Dono interno");
    expect(html).toContain("Professor interno");
    expect(html).toContain("Secretaria");
    expect(html).toContain("3 acesso(s) da equipe · 1 desativado(s)");
    expect(html).not.toContain("Aluno externo");
    expect(html).not.toContain("Responsável externo");
    expect(html).toContain('href="/admin/students"');
    expect(html).toContain('href="/admin/pre-enrollments"');
    expect(html).not.toContain('value="STUDENT"');
    expect(html).not.toContain('value="APPLICANT"');
  });

  it("lista vazia tem orientação explícita", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    expect(renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve({}) }))).toContain(
      "Nenhum acesso da equipe encontrado."
    );
  });

  it.each(["0", "-1", "abc", "2.5", "Infinity"])("página inválida %s retorna à primeira", async (value) => {
    const res = await GET(new NextRequest(`http://localhost/api/users?page=${value}`));
    expect(res.headers.get("X-Page")).toBe("1");
    expect(await res.json()).toHaveLength(3);
  });

  it("página além do fim é limitada e consulta usa paginação estável", async () => {
    vi.mocked(prisma.user.count).mockResolvedValueOnce(41).mockResolvedValueOnce(1);
    const res = await GET(new NextRequest("http://localhost/api/users?page=999"));
    expect(res.headers.get("X-Page")).toBe("3");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20, orderBy: [{ role: "asc" }, { name: "asc" }, { id: "asc" }] })
    );
  });

  it.each(["STUDENT", "APPLICANT", "TEACHER"])("%s não consulta acessos internos", async (role) => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "external", role } } as never);
    expect((await GET(new NextRequest("http://localhost/api/users"))).status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("administrador sem seção de usuários não consulta a API", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "limited", role: "ADMIN", profileSections: ["courses"] },
    } as never);
    expect((await GET(new NextRequest("http://localhost/api/users"))).status).toBe(403);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it("administrador com seção de usuários mantém consulta, sem controles de dono", async () => {
    const limited = { user: { id: "limited", role: "ADMIN", profileSections: ["users"] } };
    vi.mocked(getServerSession).mockResolvedValueOnce(limited as never);
    expect((await GET(new NextRequest("http://localhost/api/users"))).status).toBe(200);
    vi.mocked(getCachedSession).mockResolvedValueOnce(limited as never);
    const html = renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Somente consulta");
    expect(html).not.toContain("Papel na equipe");
    expect(html).not.toContain('href="/admin/students"');
  });

  for (const role of ["STUDENT", "APPLICANT"]) {
    it.each([{ role: "ADMIN" }, { profileId: "secretaria" }, { isActive: false }, { password: "teste123" }])(
      `não altera conta ${role} por esta API (%j)`,
      async (body) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "external", role } as never);
        const res = await PATCH(
          new NextRequest("http://localhost/api/users/external", { method: "PATCH", body: JSON.stringify(body) }),
          { params: Promise.resolve({ id: "external" }) }
        );
        expect(res.status).toBe(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
      }
    );
  }

  it.each(["STUDENT", "APPLICANT"])("não converte equipe em %s", async (role) => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/users/staff", { method: "PATCH", body: JSON.stringify({ role }) }),
      { params: Promise.resolve({ id: "staff" }) }
    );
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
