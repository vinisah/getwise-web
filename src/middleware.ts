import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Rotas protegidas por papel
const ADMIN_PATHS = ["/admin"];
const TEACHER_PATHS = ["/teacher"];
const STUDENT_PATHS = ["/student"];
const AUTH_PATHS = [...ADMIN_PATHS, ...TEACHER_PATHS, ...STUDENT_PATHS];

/** Home de cada papel — usado no roteamento da raiz e em redirects de papel errado. */
function roleHome(role: string | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "TEACHER") return "/teacher";
  return "/student";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isRoot = pathname === "/";
  const isProtected = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isApiProtected = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

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
