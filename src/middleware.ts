import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Rotas protegidas por papel
const ADMIN_PATHS = ["/admin"];
const TEACHER_PATHS = ["/teacher"];
const STUDENT_PATHS = ["/student"];
const AUTH_PATHS = [...ADMIN_PATHS, ...TEACHER_PATHS, ...STUDENT_PATHS];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Proteção de rotas ────────────────────────────────────────────────────
  const isProtected = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isApiProtected =
    pathname.startsWith("/api/") && !pathname.startsWith("/api/auth");

  if (isProtected || isApiProtected) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // Guard clause early: redireciona pages, retorna 401 em API
      if (isApiProtected) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Least privilege: verificar papel nas rotas específicas
    const role = token.role as string;
    if (
      ADMIN_PATHS.some((p) => pathname.startsWith(p)) &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (
      TEACHER_PATHS.some((p) => pathname.startsWith(p)) &&
      role !== "TEACHER" &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // ─── Limite de tamanho de body (413) ─────────────────────────────────────
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 3 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Payload muito grande (máx. 3MB)" },
      { status: 413 }
    );
  }

  const response = NextResponse.next();

  // ─── Security headers por request ─────────────────────────────────────────
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    // Todas as rotas exceto assets estáticos e _next interno
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg|.*\\.webp).*)",
  ],
};
