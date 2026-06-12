import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * Erro controlado da API — converte para resposta JSON com status HTTP correto.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;

/**
 * Wrapper que envolve qualquer handler de rota em try-catch.
 * - ApiError → { error: message } com status correto
 * - Outros erros → { error: "Erro interno" } com 500 (nunca expõe stack em produção)
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Erros conhecidos do Prisma → status HTTP correto (em vez de 500 genérico).
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          const target = Array.isArray(err.meta?.target)
            ? (err.meta.target as string[]).join(", ")
            : undefined;
          const message = target ? `Registro duplicado: ${target}` : "Registro duplicado";
          return NextResponse.json({ error: message }, { status: 409 });
        }
        if (err.code === "P2025") {
          return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
        }
        if (err.code === "P2003") {
          return NextResponse.json({ error: "Referência inválida" }, { status: 400 });
        }
      }
      // Falha loud no servidor: loga o erro real
      console.error("[API ERROR]", req.method, req.nextUrl.pathname, err);
      const message =
        process.env.NODE_ENV === "development" && err instanceof Error
          ? err.message
          : "Erro interno do servidor";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
