// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupResidence, municipalityKey } from "@/lib/pre-enrollment/location";
afterEach(() => vi.unstubAllGlobals());
describe("Consulta de CEP no servidor", () => {
  it.each(["123", "abcdefgh", "85960x002", "000000000"])(
    "rejeita formato inválido %s sem consultar provedor",
    async (value) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(lookupResidence(value)).rejects.toMatchObject({ status: 400 });
      expect(fetcher).not.toHaveBeenCalled();
    }
  );
  it.each([
    ["85960002", "Marechal Cândido Rondon", "4114609"],
    ["85905010", "Toledo", "4127700"],
  ])("usa o município real do CEP %s", async (cep, city, ibge) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ cep, localidade: city, uf: "PR", ibge, logradouro: "Rua exemplo", bairro: "Centro" })
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupResidence(cep)).toMatchObject({ city, municipalityCode: ibge });
    expect(fetcher).toHaveBeenCalledWith(
      `https://viacep.com.br/ws/${cep}/json/`,
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) })
    );
  });
  it("não deduz município do prefixo nem aceita resposta de outro CEP", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            cep: "85960002",
            localidade: "Toledo",
            uf: "PR",
            ibge: "4127700",
            logradouro: "",
            bairro: "",
          })
        )
    );
    expect((await lookupResidence("85960002")).city).toBe("Toledo");
    await expect(lookupResidence("85905010")).rejects.toMatchObject({ status: 503 });
  });
  it("distingue CEP inexistente de indisponibilidade", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ erro: true }))
        .mockResolvedValueOnce(new Response("fail", { status: 503 }))
        .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
    );
    await expect(lookupResidence("99999999")).rejects.toMatchObject({ status: 404 });
    await expect(lookupResidence("85960002")).rejects.toMatchObject({ status: 503 });
    await expect(lookupResidence("85960002")).rejects.toMatchObject({ status: 503 });
  });
  it("normaliza acentos/espaços, mantendo a UF", () => {
    expect(municipalityKey(" Marechal  Cândido Rondon ", "pr")).toBe(municipalityKey("MARECHAL CANDIDO RONDON", "PR"));
    expect(municipalityKey("Toledo", "PR")).not.toBe(municipalityKey("Toledo", "MG"));
  });
});
