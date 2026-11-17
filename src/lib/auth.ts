import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { PREVIEW_COOKIE } from "./effective-user";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rate-limit";

export function localDemoEnabled() {
  if (process.env.GETWISE_LOCAL_DEMO !== "1" || process.env.VERCEL) return false;
  try {
    const u = new URL(process.env.DATABASE_URL!);
    return u.hostname === "127.0.0.1" && u.pathname === "/getwise_feature";
  } catch {
    return false;
  }
}

/**
 * Conta administrativa usada exclusivamente pela avaliação local explícita.
 * O provider verifica flag, banco local, ausência de Vercel e host loopback antes desta consulta.
 */
export async function resolveDemoAdmin() {
  return prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export const authOptions: NextAuthOptions = {
  // Cast: o adapter não conhece o tipo do client com `omit` global (e nem é
  // usado de fato — sessão é JWT + credentials; fica só por compatibilidade).
  adapter: PrismaAdapter(prisma as never) as any,
  session: {
    strategy: "jwt",
    // 1 dia — janela curta para sessão roubada. Revogação de role/isActive em tempo
    // real é feita no requireAuth (re-checa o DB por request); ver lib/api-auth.ts.
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      // Credenciais individuais; demonstração disponível apenas no ambiente local explícito.
      credentials: { email: { type: "email" }, password: { type: "password" }, demo: { type: "text" } },
      async authorize(credentials, request) {
        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const demo =
          credentials?.demo === "1" &&
          localDemoEnabled() &&
          /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(String(request.headers?.host ?? ""));
        let admin;
        if (demo) admin = await resolveDemoAdmin();
        else {
          if (!email || !credentials?.password || credentials.password.length > 72) return null;
          if (!(await checkRateLimit(`login:${email}`, 10, 900000)).allowed) return null;
          admin = await prisma.user.findUnique({ where: { email }, omit: { password: false } });
          if (!admin?.isActive || !admin.password || !(await bcrypt.compare(credentials.password, admin.password)))
            return null;
        }
        if (!admin) return null;

        await audit({
          userId: admin.id,
          action: "LOGIN",
          entity: "User",
          entityId: admin.id,
          payload: { success: true, passwordless: demo },
        });

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          image: admin.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login: grava identidade no token.
      if (user) {
        token.role = (user as any).role as Role;
        token.id = user.id;
      }
      // Login E requests subsequentes: revalida no DB e popula profileSections (RBAC).
      // No login NÃO retorna cedo — senão o 1º request ficaria sem profileSections e o gate
      // do proxy seria pulado uma vez. Revalidação tb cobre desativação/rebaixamento em tempo
      // real (token sozinho ficaria defasado por até 1 dia). 1 lookup por PK indexada.
      if (token.id) {
        const db = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true, profile: { select: { sections: true } } },
        });
        if (!db || !db.isActive) {
          (token as any).disabled = true;
        } else {
          (token as any).disabled = false;
          token.role = db.role;
          // RBAC: null = dono (acesso total); array = seções permitidas.
          (token as any).profileSections = db.profile?.sections ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Conta desativada/removida → sessão sem user (getServerSession retorna inválido → 401).
      if ((token as any).disabled) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        (session.user as any).role = token.role as Role;
        (session.user as any).id = token.id as string;
        (session.user as any).profileSections = ((token as any).profileSections ?? null) as string[] | null;
      }
      return session;
    },
  },
  events: {
    // Logout limpa a "visão" do seletor de papel — senão o cookie gw_preview (TTL 2h)
    // sobrevive ao relogin e mostra chrome de aluno/professor sobre o painel admin.
    async signOut() {
      try {
        (await cookies()).delete(PREVIEW_COOKIE);
      } catch {
        // contexto sem cookies graváveis — ignora (cookie expira sozinho em 2h)
      }
    },
  },
};
