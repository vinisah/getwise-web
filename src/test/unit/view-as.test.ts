import { describe, it, expect } from "vitest";
import { representativeUserId } from "@/lib/view-as";
import { prisma } from "@/lib/prisma";

const findFirst = prisma.user.findFirst as unknown as ReturnType<typeof import("vitest").vi.fn>;

describe("representativeUserId (seletor de papel)", () => {
  it("retorna o 1º STUDENT ativo (mais antigo)", async () => {
    findFirst.mockResolvedValueOnce({ id: "s1" });
    expect(await representativeUserId("STUDENT")).toBe("s1");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "STUDENT", isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    );
  });

  it("retorna o 1º TEACHER ativo", async () => {
    findFirst.mockResolvedValueOnce({ id: "t1" });
    expect(await representativeUserId("TEACHER")).toBe("t1");
  });

  it("retorna null quando não há usuário do papel", async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await representativeUserId("STUDENT")).toBeNull();
  });

  it("ADMIN → null sem consultar o banco", async () => {
    expect(await representativeUserId("ADMIN")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
