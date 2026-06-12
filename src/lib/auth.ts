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
    // 7 dias (default era 30) — janela menor para sessão roubada.
    maxAge: 7 * 24 * 60 * 60,
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
        const { allowed, retryAfter } = checkRateLimit(
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
        resetRateLimit(`login:${email}`);

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
      if (user) {
        token.role = (user as any).role as Role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role as Role;
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
};
