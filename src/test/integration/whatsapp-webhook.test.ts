// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
const seen = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppEvent: { findUnique: seen } } }));
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Webhook Meta", () => {
  it("valida a inscrição e devolve o desafio", async () => {
    vi.stubEnv("META_VERIFY_TOKEN", "verify");
    expect((await GET(new Request("https://example.test?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"))).status).toBe(403);
    const response = await GET(new Request("https://example.test?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=123"));
    expect(await response.text()).toBe("123");
  });
  it("rejeita corpo sem assinatura", async () => {
    expect((await POST(new Request("https://example.test", { method: "POST", body: "{}" }))).status).toBe(403);
  });
  it("ignora entrega repetida de mensagem assinada", async () => {
    vi.stubEnv("META_APP_SECRET", "secret");
    vi.stubEnv("META_PHONE_NUMBER_ID", "123");
    seen.mockResolvedValue({ id: "already-processed" });
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    const body = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "123" }, messages: [{ id: "already-processed", from: "5511999999999", text: { body: "CONFIRMAR code" } }] } }] }] });
    const signature = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    const response = await POST(new Request("https://example.test", { method: "POST", headers: { "x-hub-signature-256": signature }, body }));
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
