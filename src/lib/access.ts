import { ADMIN_SECTIONS } from "./admin-sections";

/**
 * RBAC do painel admin. Regra: `profileSections == null` (usuário sem perfil) = DONO = acesso
 * total. Com perfil, só as seções listadas. Não-ADMIN nunca tem seção. Páginas usam
 * proxy.ts com revalidação no banco; APIs usam api-auth.ts; a sidebar apenas filtra links.
 */

/** Seção a que um path /admin pertence (null = rota não-gated). */
export function sectionForPath(pathname: string): string | null {
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  // /admin/profiles é gerido junto de "users".
  if (pathname.startsWith("/admin/profiles")) return "users";
  for (const s of ADMIN_SECTIONS) {
    if (s.key === "dashboard") continue;
    if (pathname === s.route || pathname.startsWith(s.route + "/")) return s.key;
  }
  return null;
}

/** Admin pode acessar a seção? null/undefined sections = dono (tudo). */
export function adminCanAccess(profileSections: string[] | null | undefined, sectionKey: string): boolean {
  if (!profileSections) return true;
  return profileSections.includes(sectionKey);
}

/** 1ª rota acessível — p/ redirecionar quando a seção pedida é negada. */
export function firstAllowedRoute(profileSections: string[] | null | undefined): string {
  if (!profileSections) return "/admin";
  const first = ADMIN_SECTIONS.find((s) => profileSections.includes(s.key));
  return first?.route ?? "/admin";
}
