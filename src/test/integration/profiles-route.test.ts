import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createPOST } from "@/app/api/profiles/route";
import { DELETE as profileDELETE, PATCH as profilePATCH } from "@/app/api/profiles/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);
const ap = prisma.accessProfile as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const userCount = prisma.user.count as unknown as ReturnType<typeof vi.fn>;
const admin = { user: { id: "a1", role: "ADMIN" as const, name: "A", email: "a@a.com" } };
const teacher = { user: { id: "t1", role: "TEACHER" as const, name: "T", email: "t@t.com" } };

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const delCtx = { params: Promise.resolve({ id: "p1" }) };
const delReq = () => new NextRequest("http://localhost/api/profiles/p1", { method: "DELETE" });
const patchReq = (body: unknown) =>
  new NextRequest("http://localhost/api/profiles/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  (prisma.auditLog.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("POST /api/profiles", () => {
  it("perfil válido → 201", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce(null);
    ap.create.mockResolvedValueOnce({ id: "p1", name: "Secretaria", sections: ["dashboard", "students"] });
    expect((await createPOST(postReq({ name: "Secretaria", sections: ["dashboard", "students"] }))).status).toBe(201);
  });

  it("não-admin → 403", async () => {
    mockSession.mockResolvedValueOnce(teacher as never);
    expect((await createPOST(postReq({ name: "X", sections: ["dashboard"] }))).status).toBe(403);
  });

  it("seção inválida → 400", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    expect((await createPOST(postReq({ name: "X", sections: ["nao-existe"] }))).status).toBe(400);
  });

  it("sem seções → 400", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    expect((await createPOST(postReq({ name: "X", sections: [] }))).status).toBe(400);
  });

  it("nome duplicado → 409", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p0", name: "Secretaria" });
    expect((await createPOST(postReq({ name: "Secretaria", sections: ["dashboard"] }))).status).toBe(409);
  });
});

describe("DELETE /api/profiles/[id]", () => {
  it("perfil de sistema → 400 (não apaga)", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "Secretaria", isSystem: true });
    expect((await profileDELETE(delReq(), delCtx as never)).status).toBe(400);
  });

  it("perfil normal sem usuários → 200", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "X", isSystem: false });
    userCount.mockResolvedValueOnce(0);
    ap.delete.mockResolvedValueOnce({});
    expect((await profileDELETE(delReq(), delCtx as never)).status).toBe(200);
  });

  it("perfil em uso por usuários → 409 (não apaga; evita escalação via SetNull)", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "X", isSystem: false });
    userCount.mockResolvedValueOnce(3);
    expect((await profileDELETE(delReq(), delCtx as never)).status).toBe(409);
    expect(ap.delete).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/profiles/[id]", () => {
  it("perfil de sistema → 400 (imutável, simétrico ao DELETE)", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "Secretaria", isSystem: true });
    expect((await profilePATCH(patchReq({ name: "Outro" }), delCtx as never)).status).toBe(400);
    expect(ap.update).not.toHaveBeenCalled();
  });

  it("renomear p/ nome existente → 409", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "X", isSystem: false }); // alvo
    ap.findUnique.mockResolvedValueOnce({ id: "p2", name: "Comercial" }); // dup do novo nome
    expect((await profilePATCH(patchReq({ name: "Comercial" }), delCtx as never)).status).toBe(409);
  });

  it("edição válida → 200", async () => {
    mockSession.mockResolvedValueOnce(admin as never);
    ap.findUnique.mockResolvedValueOnce({ id: "p1", name: "X", isSystem: false });
    ap.update.mockResolvedValueOnce({ id: "p1", name: "X", sections: ["dashboard", "financial"] });
    expect((await profilePATCH(patchReq({ sections: ["dashboard", "financial"] }), delCtx as never)).status).toBe(200);
  });
});
