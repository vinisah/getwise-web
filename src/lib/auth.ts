import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit, resetRateLimit, LIMITS } from "./rate-limit";
import { audit } from "./audit";
import type { Role } from "@prisma/client";

// Hash bcrypt válido de string aleatória — usado para igualar o tempo de resposta
// quando o e-mail não existe (anti-enumeração por timing).
const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

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
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        // Rate limit por email (5 tentativas / 15 min)
        const { allowed, retryAfter } = await checkRateLimit(
          `login:${email}`,
          LIMITS.LOGIN.max,
          LIMITS.LOGIN.windowMs
        );

        if (!allowed) {
          // Fail loud: mensagem clara com tempo restante
          throw new Error(
            `Muitas tentativas. Tente novamente em ${retryAfter} segundo(s).`
          );
        }

        // Opt-in explícito do hash: o client global omite password em tudo.
        const user = await prisma.user.findUnique({
          where: { email },
          omit: { password: false },
        });

        if (!user || !user.password) {
          // Roda bcrypt mesmo sem usuário → tempo de resposta constante
          // (não revela por timing se o e-mail existe).
          await bcrypt.compare(credentials.password, DUMMY_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          await audit({
            userId: user.id,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
            payload: { success: false, email },
          });
          return null;
        }

        // Conta desativada pelo admin → login bloqueado
        if (!user.isActive) {
          throw new Error("Conta desativada. Fale com a administração.");
        }

        // Regra de negócio: e-mail deve estar confirmado para logar
        if (!user.emailVerified) {
          throw new Error("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
        }

        // Login bem-sucedido: reset do contador
        await resetRateLimit(`login:${email}`);

        await audit({
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          payload: { success: true },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
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
        return token;
      }
      // Requests subsequentes: revalida no DB (desativação/rebaixamento valem em tempo
      // real; o token sozinho ficaria defasado por até 1 dia). 1 lookup por PK indexada.
      if (token.id) {
        const db = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true },
        });
        if (!db || !db.isActive) {
          (token as any).disabled = true;
        } else {
          (token as any).disabled = false;
          token.role = db.role;
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
      }
      return session;
    },
  },
};
