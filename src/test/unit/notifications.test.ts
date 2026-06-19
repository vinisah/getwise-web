import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createNotification } from "@/lib/services/notifications";
import { POST as readPOST } from "@/app/api/notifications/read/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const notif = prisma.notification as unknown as {
  create: ReturnType<typeof import("vitest").vi.fn>;
  updateMany: ReturnType<typeof import("vitest").vi.fn>;
};
const mockSession = vi.mocked(getServerSession);
const student = { user: { id: "s1", role: "STUDENT" as const, name: "S", email: "s@s.com" } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createNotification", () => {
  it("cria notificação com os campos", async () => {
    notif.create.mockResolvedValueOnce({});
    await createNotification({ userId: "u1", type: "CERTIFICATE_ISSUED", title: "T", body: "B", link: "/x" });
    expect(notif.create).toHaveBeenCalledWith({
      data: { userId: "u1", type: "CERTIFICATE_ISSUED", title: "T", body: "B", link: "/x" },
    });
  });

  it("link ausente vira null", async () => {
    notif.create.mockResolvedValueOnce({});
    await createNotification({ userId: "u1", type: "PAYMENT_DUE", title: "T", body: "B" });
    expect(notif.create.mock.calls[0][0].data.link).toBeNull();
  });

  it("erro NÃO propaga (best-effort)", async () => {
    notif.create.mockRejectedValueOnce(new Error("db down"));
    await expect(
      createNotification({ userId: "u1", type: "PAYMENT_DUE", title: "T", body: "B" })
    ).resolves.toBeUndefined();
  });
});

describe("POST /api/notifications/read", () => {
  it("marca UMA, escopada ao próprio userId (IDOR-safe)", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    notif.updateMany.mockResolvedValueOnce({ count: 1 });
    const res = await readPOST(req({ id: "n1" }));
    expect(res.status).toBe(200);
    expect(notif.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "s1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("sem id marca todas as não lidas do usuário", async () => {
    mockSession.mockResolvedValueOnce(student as any);
    notif.updateMany.mockResolvedValueOnce({ count: 3 });
    const res = await readPOST(req({}));
    expect(res.status).toBe(200);
    expect(notif.updateMany).toHaveBeenCalledWith({
      where: { userId: "s1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
