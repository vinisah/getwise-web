import { createSchedulingTransactionFixture } from "@/test/fixtures/scheduling-transaction";
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";

// E-mail é enviado em modo dev (console) — sem SMTP, não quebra
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);

function req(body: unknown, ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  it("400 dados inválidos (senha curta)", async () => {
    const res = await POST(req({ name: "João", email: "j@j.com", password: "123" }, "ip-a"));
    expect(res.status).toBe(400);
  });

  it("409 e-mail já cadastrado", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce({ id: "existing" });
    const res = await POST(req({ name: "João Silva", email: "dup@d.com", password: "senha123" }, "ip-b"));
    expect(res.status).toBe(409);
  });

  it("201 cria conta + token de verificação", async () => {
    (mockPrisma.user.findUnique as any).mockResolvedValueOnce(null);
    (mockPrisma.user.create as any).mockResolvedValueOnce({ id: "new1", email: "novo@n.com" });
    (mockPrisma.emailVerificationToken.create as any).mockResolvedValueOnce({});
    const transaction = createSchedulingTransactionFixture(mockPrisma.user, "new1");
    (mockPrisma.$transaction as any).mockImplementationOnce((callback: any) => callback(transaction));
    (mockPrisma.auditLog.create as any).mockResolvedValueOnce({});
    const res = await POST(req({ name: "Novo Aluno", email: "novo@n.com", password: "senha123" }, "ip-c"));
    expect(res.status).toBe(201);
    expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();
  });
});
