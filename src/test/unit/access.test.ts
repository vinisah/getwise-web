import { describe, it, expect } from "vitest";
import { sectionForPath, adminCanAccess, firstAllowedRoute } from "@/lib/access";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";

describe("sectionForPath", () => {
  it("/admin → dashboard", () => expect(sectionForPath("/admin")).toBe("dashboard"));
  it("sub-rotas casam o prefixo", () => {
    expect(sectionForPath("/admin/students/new")).toBe("students");
    expect(sectionForPath("/admin/lessons/abc/edit")).toBe("lessons");
    expect(sectionForPath("/admin/financial")).toBe("financial");
  });
  it("/admin/profiles é gerido por 'users'", () => expect(sectionForPath("/admin/profiles")).toBe("users"));
  it("rota fora do mapa → null", () => expect(sectionForPath("/admin/qualquer-coisa")).toBeNull());
});

describe("adminCanAccess", () => {
  it("sem perfil (null) = dono = tudo", () => {
    expect(adminCanAccess(null, "financial")).toBe(true);
    expect(adminCanAccess(undefined, "users")).toBe(true);
  });
  it("perfil restrito só as seções listadas", () => {
    expect(adminCanAccess(["dashboard", "students"], "students")).toBe(true);
    expect(adminCanAccess(["dashboard", "students"], "financial")).toBe(false);
  });
});

describe("firstAllowedRoute", () => {
  it("null → /admin", () => expect(firstAllowedRoute(null)).toBe("/admin"));
  it("1ª seção permitida na ordem canônica", () => {
    expect(firstAllowedRoute(["financial", "students"])).toBe("/admin/students"); // students vem antes na lista
    expect(firstAllowedRoute(["dre", "audit"])).toBe("/admin/dre");
  });
  it("sections=[] → /admin (fallback; o proxy corta o loop com 403)", () => {
    expect(firstAllowedRoute([])).toBe("/admin");
  });
});

// Invariante anti-loop: a rota de pouso de QUALQUER perfil de 1 seção não pode ser negada
// pelo próprio gate (senão proxy redirecionaria de volta → loop). Garante que sectionForPath
// da rota escolhida bate com a seção concedida, p/ todas as 13 seções canônicas.
describe("invariante: landing não é re-negado pelo gate", () => {
  for (const s of ADMIN_SECTIONS) {
    it(`perfil [${s.key}] pousa numa rota da própria seção`, () => {
      const dest = firstAllowedRoute([s.key]);
      const landedSection = sectionForPath(dest);
      expect(landedSection).toBe(s.key);
      expect(adminCanAccess([s.key], landedSection!)).toBe(true);
    });
  }
});
