import { afterEach, describe, expect, it, vi } from "vitest";
import { authOptions, localDemoEnabled } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
const authorize = (
  authOptions.providers[0] as unknown as {
    options: {
      authorize: (
        credentials: Record<string, string>,
        request: { headers: { host: string } }
      ) => Promise<{ id: string } | null>;
    };
  }
).options.authorize;
afterEach(() => vi.unstubAllEnvs());
describe("acesso individual e avaliação local", () => {
  it("mantém origem demo no JWT/sessão mesmo se o administrador escolhido for diretor", async () => {
    vi.stubEnv("GETWISE_LOCAL_DEMO", "1");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://127.0.0.1:55432/getwise_feature");
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
      id: "oldest-director",
      role: "ADMIN",
      isActive: true,
      isSchoolDirector: true,
      email: "director@example.invalid",
    } as never);
    const user = await authorize({ demo: "1" }, { headers: { host: "127.0.0.1:3001" } });
    expect(user).toMatchObject({ id: "oldest-director", authMethod: "demo" });
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: "ADMIN", isActive: true, profile: null } as never);
    const token = await authOptions.callbacks!.jwt!({ token: {}, user } as never);
    const session = await authOptions.callbacks!.session!({ token, session: { user: {} } } as never);
    expect(session).toMatchObject({ user: { id: "oldest-director", authMethod: "demo" } });
  });
  it("credenciais vazias não autenticam administrador", async () => {
    vi.stubEnv("GETWISE_LOCAL_DEMO", "");
    expect(await authorize({}, { headers: { host: "127.0.0.1:3001" } })).toBeNull();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it("demo é impossível na Vercel mesmo com flag ativada", () => {
    vi.stubEnv("GETWISE_LOCAL_DEMO", "1");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/getwise_feature");
    expect(localDemoEnabled()).toBe(false);
  });
  it("demo local exige host loopback e banco correto", async () => {
    vi.stubEnv("GETWISE_LOCAL_DEMO", "1");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://127.0.0.1:55432/getwise_feature");
    expect(await authorize({ demo: "1" }, { headers: { host: "public.example.com" } })).toBeNull();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it("senha correta acessa a própria conta de pré-matrícula", async () => {
    const password = await bcrypt.hash("senha-de-teste", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "family",
      email: "family@example.test",
      password,
      isActive: true,
      role: "APPLICANT",
    } as never);
    const user = await authorize(
      { email: "family@example.test", password: "senha-de-teste" },
      { headers: { host: "localhost" } }
    );
    expect(user?.id).toBe("family");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it("senha incorreta não autentica", async () => {
    const password = await bcrypt.hash("senha-de-teste", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "family", password, isActive: true } as never);
    expect(
      await authorize({ email: "other@example.test", password: "errada" }, { headers: { host: "localhost" } })
    ).toBeNull();
  });
});
