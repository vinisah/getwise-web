import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

/** Rótulos PT dos campos de formulário — para a mensagem de erro apontar o campo. */
const FIELD_LABELS: Record<string, string> = {
  name: "Nome", email: "E-mail", password: "Senha", phone: "Telefone", cpf: "CPF",
  state: "Estado (UF)", city: "Cidade", zipCode: "CEP", address: "Endereço", birthDate: "Nascimento",
  title: "Título", description: "Descrição", scheduledAt: "Data/hora", duration: "Duração",
  meetingUrl: "Link da reunião", level: "Nível", amount: "Valor", date: "Data",
  dueDate: "Vencimento", startDate: "Data de início", salary: "Salário", role: "Cargo/Papel",
  planId: "Plano", studentId: "Aluno", discount: "Desconto", price: "Preço",
  reference: "Referência", month: "Mês", year: "Ano", percent: "Percentual", contractType: "Contrato",
};

/**
 * Primeira mensagem de erro do Zod, prefixada pelo rótulo (PT) do campo quando disponível —
 * para o usuário saber QUAL campo falhou (antes vinha só a mensagem ou "Dados inválidos").
 */
export function zodMessage(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Dados inválidos";
  const key = issue.path.find((p) => typeof p === "string") as string | undefined;
  const label = key ? FIELD_LABELS[key] ?? key : "";
  return label ? `${label}: ${issue.message}` : issue.message;
}

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
      // Entrada malformada que escapou do Zod (enum/campo/tipo) → 400, não 500.
      if (err instanceof Prisma.PrismaClientValidationError) {
        return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
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
