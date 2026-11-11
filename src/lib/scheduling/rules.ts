import { z } from "zod";
export const ContentLevel = z.enum(["A1", "A2", "A3"]);
export const CohortInput = z.object({
  name: z.string().trim().min(2).max(100),
  level: ContentLevel,
  capacity: z.coerce.number().int().min(1).max(100),
  teacherId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  startsAt: z.string().datetime({ offset: true }),
  weeks: z.coerce.number().int().min(1).max(104),
  duration: z.coerce.number().int().min(15).max(180),
});
export const ResponseInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), bookingId: z.string().min(1) }),
  z.object({ action: z.literal("decline"), bookingId: z.string().min(1), reason: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("reschedule"), bookingId: z.string().min(1), lessonId: z.string().min(1) }),
]);
export function assertAvailable(level: string, targetLevel: string, capacity: number, occupied: number) {
  if (level !== targetLevel) throw new Error("Escolha uma aula do mesmo nível");
  if (occupied >= capacity) throw new Error("Esta aula está lotada");
}
export function weeklyDates(start: string, weeks: number): Date[] {
  return Array.from({ length: weeks }, (_, index) => new Date(new Date(start).getTime() + index * 7 * 86400000));
}
