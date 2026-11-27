import { z } from "zod";
import { PersonSchema, emptyApplication, emptyPerson, isMinor } from "./schema";
import { CepSchema } from "./location-contract";

export const PlacementSchema = z.object({
  student: PersonSchema.pick({ name: true, cpf: true, birthDate: true }).extend({ zipCode: CepSchema }),
  schoolUnitId: z.string().min(1).max(200),
  reason: z.string().trim().min(10, "Explique sua necessidade em pelo menos 10 caracteres.").max(2000),
  contact: z.object({ name: z.string().trim().min(3).max(200), email: z.email().transform((s) => s.toLowerCase()) }),
});
export type PlacementData = z.infer<typeof PlacementSchema>;
export function placementDraft(input: PlacementData) {
  const minor = isMinor(input.student.birthDate);
  return {
    ...structuredClone(emptyApplication),
    schoolUnitId: input.schoolUnitId,
    student: { ...emptyPerson, ...input.student, email: minor ? "" : input.contact.email },
    guardian: minor ? { ...emptyPerson, ...input.contact } : null,
  };
}
