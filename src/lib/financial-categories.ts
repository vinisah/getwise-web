import { prisma } from "@/lib/prisma";

/**
 * Resolve o id de uma categoria financeira pelo nome canônico, para taggear lançamentos
 * gerados pelo sistema (mensalidade paga, boleto, folha) e alimentar o DRE.
 *
 * Sem isso, esses lançamentos ficam sem categoria → caem em "(não classificado)" no DRE
 * (a cascata zera). Se a categoria não existir/for renomeada, retorna null e o lançamento
 * fica não classificado (visível no aviso do DRE, nunca some).
 */
export async function categoryIdByName(name: string): Promise<string | null> {
  const c = await prisma.financialCategory.findFirst({ where: { name }, select: { id: true } });
  return c?.id ?? null;
}

/** Nomes canônicos das categorias usadas pelos fluxos do sistema (devem existir no seed). */
export const SYSTEM_CATEGORY = {
  MENSALIDADE: "Mensalidade",
  SALARIOS: "Salários",
} as const;
