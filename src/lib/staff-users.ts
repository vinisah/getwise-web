import { prisma } from "./prisma";
import { STAFF_ROLES } from "./roles";

const PAGE_SIZE = 20;

/** Fonte comum da página e da API de acessos internos, incluindo seus contadores. */
export async function listStaffUsers(rawPage?: string | null) {
  const requestedPage = Number(rawPage ?? 1);
  const where = { role: { in: [...STAFF_ROLES] } };
  const [total, inactive] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, isActive: false } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      profileId: true,
      profile: { select: { name: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { users, total, inactive, page, pages, pageSize: PAGE_SIZE };
}
