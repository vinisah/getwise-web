import { describe, it, expect } from "vitest";
import { resolveDemoAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const findFirst = prisma.user.findFirst as unknown as ReturnType<typeof import("vitest").vi.fn>;

describe("resolveDemoAdmin (login passwordless)", () => {
  it("retorna o ADMIN ativo mais antigo", async () => {
    findFirst.mockResolvedValueOnce({ id: "a1", name: "Admin", email: "a@a.com", role: "ADMIN", image: null });
    const admin = await resolveDemoAdmin();
    expect(admin?.id).toBe("a1");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "ADMIN", isActive: true },
        orderBy: { createdAt: "asc" },
      })
    );
  });

  it("retorna null quando não há admin ativo", async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await resolveDemoAdmin()).toBeNull();
  });
});
