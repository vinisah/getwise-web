import { prisma } from "./prisma";

export type ViewAsRole = "ADMIN" | "TEACHER" | "STUDENT";

/**
 * Resolve o usuário representante de um papel para a "visão" do admin (seletor do topbar).
 * Pega o primeiro usuário ativo daquele papel (mais antigo). ADMIN ou papel inválido → null
 * (a visão admin não usa cookie de preview; o representante deve ser STUDENT/TEACHER).
 */
export async function representativeUserId(role: ViewAsRole): Promise<string | null> {
  if (role !== "STUDENT" && role !== "TEACHER") return null;
  const u = await prisma.user.findFirst({
    where: { role, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return u?.id ?? null;
}
