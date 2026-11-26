import { z } from "zod";
import { ApiError } from "@/lib/api-error";

import { CepSchema, type Residence } from "./location-contract";
export { municipalityKey, type Residence } from "./location-contract";
const ResponseSchema = z.object({
  cep: CepSchema,
  localidade: z.string().trim().min(1),
  uf: z.string().regex(/^[A-Z]{2}$/),
  ibge: z.string().regex(/^\d{7}$/),
  logradouro: z.string(),
  bairro: z.string(),
});
/** Server-only consultation: no prefix inference, user URL or client-supplied municipality. */
export async function lookupResidence(value: string): Promise<Residence> {
  const parsed = CepSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "Informe um CEP com oito dígitos.");
  try {
    const response = await fetch(`https://viacep.com.br/ws/${parsed.data}/json/`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const body = await response.json();
    if (body?.erro === true || body?.erro === "true")
      throw new ApiError(404, "CEP não encontrado. Confira os números e tente novamente.");
    const data = ResponseSchema.parse(body);
    if (data.cep !== parsed.data) throw new Error("Unexpected CEP");
    return {
      zipCode: data.cep,
      city: data.localidade,
      state: data.uf,
      municipalityCode: data.ibge,
      address: data.logradouro,
      neighborhood: data.bairro,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "A consulta de CEP está indisponível. Tente novamente em instantes; seus dados foram preservados."
    );
  }
}
