import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { proxy } from "@/proxy";

// getToken já é mockado globalmente em test/setup.ts.
const mockToken = vi.mocked(getToken);

function go(path: string) {
  return proxy(new NextRequest(`http://localhost${path}`));
}

beforeEach(() => {
  mockToken.mockReset();
});

describe("proxy — gate RBAC de páginas admin", () => {
  it("sem token em página protegida → redirect /login", async () => {
    mockToken.mockResolvedValueOnce(null as never);
    const res = await go("/admin/financial");
    expect(res.headers.get("location")).toContain("/login");
  });

  it("dono (ADMIN, profileSections null) acessa qualquer seção", async () => {
    mockToken.mockResolvedValueOnce({ id: "a1", role: "ADMIN", profileSections: null } as never);
    const res = await go("/admin/financial");
    expect(res.headers.get("location")).toBeNull(); // NextResponse.next()
    expect(res.status).toBe(200);
  });

  it("admin restrito acessa seção PERMITIDA", async () => {
    mockToken.mockResolvedValueOnce({ id: "a2", role: "ADMIN", profileSections: ["financial"] } as never);
    const res = await go("/admin/financial");
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("admin restrito em seção NEGADA → redirect p/ 1ª permitida", async () => {
    mockToken.mockResolvedValueOnce({ id: "a3", role: "ADMIN", profileSections: ["dashboard"] } as never);
    const res = await go("/admin/financial");
    const loc = res.headers.get("location");
    expect(loc).not.toBeNull();
    expect(new URL(loc!).pathname).toBe("/admin"); // firstAllowedRoute(["dashboard"])
  });

  it("admin com sections=[] em /admin → 403 (corta loop de redirect)", async () => {
    mockToken.mockResolvedValueOnce({ id: "a4", role: "ADMIN", profileSections: [] } as never);
    const res = await go("/admin");
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
  });

  it("não-ADMIN em /admin → redirect p/ home do papel (não vaza painel)", async () => {
    mockToken.mockResolvedValueOnce({ id: "s1", role: "STUDENT" } as never);
    const res = await go("/admin/students");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/student");
  });
});
