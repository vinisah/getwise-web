import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/me/prefs/route";
import { DEFAULT_PREFS } from "@/lib/theme";

function request(body?: unknown) {
  return new NextRequest(
    "http://localhost/api/me/prefs",
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", origin: "http://localhost" },
          body: JSON.stringify(body),
        }
  );
}
beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "student-self", role: "STUDENT" } } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ uiPrefs: null } as never);
  vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });
});

describe("Preferências pessoais", () => {
  it("requires authentication", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request({ nickname: "Ana" }))).status).toBe(401);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("reads defaults and version only from the authenticated account", async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ prefs: DEFAULT_PREFS, version: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "student-self" }, select: { uiPrefs: true } });
  });
  it("persists personal preferences without changing the academic name", async () => {
    const { version } = await (await GET(request())).json();
    const response = await POST(request({ nickname: "  Ana  ", theme: "royal", version }));
    expect(response.status).toBe(200);
    const { prefs, version: nextVersion } = await response.json();
    expect(prefs.nickname).toBe("Ana");
    expect(prefs.theme).toBe("royal");
    expect(nextVersion).not.toBe(version);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "student-self", uiPrefs: expect.any(Object) },
      data: { uiPrefs: prefs },
    });
  });
  it.each([
    { nickname: "x".repeat(31) },
    { nickname: "<script>" },
    { nickname: "Ana\nMaria" },
    { accent: "#FFFFFF" },
    { theme: "__proto__" },
    { userId: "another", nickname: "Ana" },
    { role: "ADMIN" },
    {},
  ])("rejects invalid or unowned fields: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("keeps new preferences when an older appearance client saves a patch", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      uiPrefs: { ...DEFAULT_PREFS, nickname: "Lia", tutorPace: "instant" },
    } as never);
    const response = await POST(request({ theme: "premium" }));
    expect((await response.json()).prefs).toMatchObject({ theme: "premium", nickname: "Lia", tutorPace: "instant" });
  });
  it("rejects stale tabs and concurrent writes without overwriting", async () => {
    const { version } = await (await GET(request())).json();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      uiPrefs: { ...DEFAULT_PREFS, nickname: "Other tab" },
    } as never);
    expect((await POST(request({ nickname: "Ana", version }))).status).toBe(409);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ uiPrefs: null } as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 });
    expect((await POST(request({ nickname: "Ana", version }))).status).toBe(409);
  });
  it("accepts an idempotent retry after a lost success response", async () => {
    const { version } = await (await GET(request())).json();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ uiPrefs: { ...DEFAULT_PREFS, nickname: "Ana" } } as never);
    expect((await POST(request({ nickname: "Ana", version }))).status).toBe(200);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
