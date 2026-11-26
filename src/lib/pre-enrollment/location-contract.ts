import { z } from "zod";
export const CepSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, "Informe um CEP com oito dígitos.")
  .transform((v) => v.replace("-", ""));
export type Residence = {
  zipCode: string;
  city: string;
  state: string;
  municipalityCode: string;
  address: string;
  neighborhood: string;
};
export function municipalityKey(city: string, state: string) {
  return `${state.trim().toUpperCase()}:${city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()}`;
}
