import { z } from "zod";
import { ACCENT_CHOICES } from "./theme";

export const preferencesSchema = z
  .object({
    theme: z.enum(["marinho", "royal", "premium"]),
    accent: z.enum(ACCENT_CHOICES),
    density: z.enum(["espacoso", "compacto"]),
    radius: z.union([z.literal(10), z.literal(16), z.literal(22)]),
    sidebar: z.enum(["gradiente", "solida"]),
    nickname: z
      .string()
      .trim()
      .max(30, "Use até 30 caracteres.")
      .refine((value) => !/[<>\p{Cc}\p{Cf}]/u.test(value), "Use um apelido em uma linha, sem sinais < ou >."),
    motion: z.enum(["system", "reduced"]),
    tutorPace: z.enum(["calm", "quick", "instant"]),
  })
  .strict();

// Partial updates keep older appearance clients compatible without erasing new fields.
export const preferencesUpdateSchema = preferencesSchema
  .partial()
  .extend({
    version: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "version"), "Escolha uma preferência para salvar.");
