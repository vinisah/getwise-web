import { describe, it, expect, vi } from "vitest";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

function mockReq(url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(url, { method: "POST" });
}

describe("ApiError", () => {
  it("has correct status and message", () => {
    const err = new ApiError(401, "Não autenticado");
    expect(err.status).toBe(401);
    expect(err.message).toBe("Não autenticado");
    expect(err.name).toBe("ApiError");
  });

  it("is instanceof Error", () => {
    expect(new ApiError(403, "test")).toBeInstanceOf(Error);
  });
});

describe("withErrorHandler", () => {
  it("passes through successful response", async () => {
    const handler = withErrorHandler(async () =>
      NextResponse.json({ ok: true }, { status: 200 })
    );
    const res = await handler(mockReq());
    expect(res.status).toBe(200);
  });

  it("converts ApiError to JSON response with correct status", async () => {
    const handler = withErrorHandler(async () => {
      throw new ApiError(403, "Acesso negado");
    });
    const res = await handler(mockReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Acesso negado");
  });

  it("mapeia P2002 (unique) para 409 com o campo duplicado", async () => {
    const handler = withErrorHandler(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.0.0",
        meta: { target: ["cpf"] },
      });
    });
    const res = await handler(mockReq());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("cpf");
  });

  it("mapeia P2025 (not found) para 404", async () => {
    const handler = withErrorHandler(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Not found", { code: "P2025", clientVersion: "7.0.0" });
    });
    const res = await handler(mockReq());
    expect(res.status).toBe(404);
  });

  it("converts unknown errors to 500 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const handler = withErrorHandler(async () => {
      throw new Error("DB connection failed with password=secret");
    });
    const res = await handler(mockReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Erro interno do servidor");
    // Nunca expõe stack/senha ao cliente em produção
    expect(body.error).not.toContain("secret");
    vi.unstubAllEnvs();
  });
});
