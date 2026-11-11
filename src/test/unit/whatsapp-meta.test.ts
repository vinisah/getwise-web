// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMetaTemplate, verifyMetaSignature } from "@/lib/whatsapp/meta";

afterEach(() => vi.unstubAllGlobals());

describe("Meta Cloud API", () => {
  const config = { accessToken: "test-token", phoneNumberId: "1234", apiVersion: "v24.0" };
  it("valida o corpo original e rejeita adulteração", () => {
    const body = '{"entry":[]}';
    const signature = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyMetaSignature(body, signature, "secret")).toBe(true);
    expect(verifyMetaSignature(body + " ", signature, "secret")).toBe(false);
    expect(verifyMetaSignature(body, signature, "other")).toBe(false);
  });
  it.each([null, "", "sha256=invalid", "sha256=" + "a".repeat(62)])("rejeita assinatura inválida %s", (signature) => {
    expect(verifyMetaSignature("{}", signature, "secret")).toBe(false);
  });
  it("envia o template aprovado com parâmetros e retorna o identificador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMetaTemplate(config, "5511999999999", "confirmar_aula", ["Ana"])).toBe("wamid.test");
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v24.0/1234/messages");
    expect(JSON.parse(request.body).template.components[0].parameters).toEqual([{ type: "text", text: "Ana" }]);
  });
  it("propaga falha de envio sem expor o token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private", { status: 429 })));
    await expect(sendMetaTemplate(config, "5511999999999", "confirmar_aula", [])).rejects.toThrow("HTTP 429");
  });
  it("rejeita destinatário inválido antes de enviar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendMetaTemplate(config, "+55 invalid", "confirmar_aula", [])).rejects.toThrow("Telefone");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
