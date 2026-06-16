import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_PATHS, TEACHER_PATHS, AUTH_PATHS, roleHome } from "@/lib/roles";

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

    const role = token.role as string | undefined;

    // Raiz: roteia direto p/ a home do papel (mata a cadeia / → /login → role-home).
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
    // Todas as rotas exceto assets estáticos e _next interno
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg|.*\\.webp).*)",
  ],
};
