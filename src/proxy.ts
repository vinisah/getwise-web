import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_PATHS, TEACHER_PATHS, AUTH_PATHS, roleHome } from "@/lib/roles";
import { sectionForPath, firstAllowedRoute } from "@/lib/access";
import { prisma } from "@/lib/prisma";

// Next 16: convenção `middleware` foi renomeada para `proxy` (roda em Node.js).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isRoot = pathname === "/";
  const isProtected = AUTH_PATHS.some((p) => pathname.startsWith(p));
  // Rotas /api que se autoprotegem (não podem exigir cookie aqui):
  // - /api/auth: NextAuth; /api/upload: handleUpload do Blob (callback HMAC server-to-server);
  // - /api/webhooks/*: webhook do provedor de pagamento (valida token próprio, ex.: Asaas);
  // - /api/billing/generate-due: cron de cobrança (valida CRON_SECRET) ou admin via cookie.
  const PUBLIC_API = ["/api/auth", "/api/upload", "/api/webhooks/", "/api/billing/generate-due"];
  const isApiProtected = pathname.startsWith("/api/") && !PUBLIC_API.some((p) => pathname.startsWith(p));

  if (isRoot || isProtected || isApiProtected) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      if (isApiProtected) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      if (!isRoot) loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    let role = token.role as string | undefined;
    let sections = (token as { profileSections?: string[] | null }).profileSections;
    // Páginas consultam o banco diretamente. Não podem autorizar usando um JWT antigo
    // depois que o dono remove uma permissão ou rebaixa/desativa a conta.
    if (!pathname.startsWith("/api/")) {
      const current =
        typeof token.id === "string"
          ? await prisma.user.findUnique({
              where: { id: token.id },
              select: { isActive: true, role: true, profile: { select: { sections: true } } },
            })
          : null;
      if (!current?.isActive) return NextResponse.redirect(new URL("/login", req.url));
      role = current.role;
      sections = current.profile?.sections ?? null;
    }

    // Raiz: roteia direto p/ a home do papel (mata a cadeia / → /login → role-home).
    if (
      role === "APPLICANT" &&
      !isRoot &&
      !pathname.startsWith("/pre-enrollments") &&
      !pathname.startsWith("/api/pre-enrollments")
    ) {
      if (pathname.startsWith("/api/"))
        return NextResponse.json({ error: "Acesso restrito ao acompanhamento de pré-matrículas." }, { status: 403 });
      return NextResponse.redirect(new URL("/pre-enrollments", req.url));
    }
    if (isRoot) {
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }

    // Least privilege: papel errado vai direto p/ a própria home (sem passar pela raiz).
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }
    if (TEACHER_PATHS.some((p) => pathname.startsWith(p)) && role !== "TEACHER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }

    // RBAC: admin com perfil RESTRITO só acessa as seções permitidas (null = dono = tudo).
    // PÁGINAS admin usam permissões atuais; APIs também exigem a seção em api-auth.ts.
    if (role === "ADMIN" && pathname.startsWith("/admin")) {
      if (sections) {
        const sec = sectionForPath(pathname);
        if (sec && !sections.includes(sec)) {
          const dest = firstAllowedRoute(sections);
          // Perfil sem nenhuma seção válida (ex.: sections=[]) → firstAllowedRoute cai em /admin
          // e o gate re-nega → loop de redirect. Corta com 403 em vez de redirecionar p/ a própria
          // rota negada. Estado normalmente impossível (POST/PATCH exigem min(1) seção).
          if (dest === pathname) {
            return new NextResponse("Sem seções de acesso liberadas. Contate o administrador.", { status: 403 });
          }
          return NextResponse.redirect(new URL(dest, req.url));
        }
      }
    }
  }

  // Limite de tamanho de body (413)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload muito grande (máx. 3MB)" }, { status: 413 });
  }

  // Security headers ficam só no next.config.ts (evita aplicação dupla por request).
  return NextResponse.next();
}

export const config = {
  matcher: [
    // IDs/rotas protegidas com sufixo de imagem não podem escapar do controle.
    "/api/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    // Todas as rotas exceto assets estáticos e _next interno
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg|.*\\.webp).*)",
  ],
};
