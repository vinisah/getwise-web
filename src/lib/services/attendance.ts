import { prisma } from "../prisma";

/**
 * Presença/frequência REAL sobre LessonBooking.attendance (Boolean?: true=presente,
 * false=ausente, null=não marcado) e rating (Int? 1-5). Agregações puras de leitura.
 */

export interface StudentFrequency {
  marked: number; // aulas com presença marcada
  attended: number; // presenças
  percent: number | null; // null quando nada foi marcado ainda
}

/** Frequência do aluno: presenças sobre aulas com presença marcada. */
export async function studentFrequency(studentId: string): Promise<StudentFrequency> {
  const bookings = await prisma.lessonBooking.findMany({
    where: { studentId, attendance: { not: null } },
    select: { attendance: true },
  });
  const marked = bookings.length;
  const attended = bookings.filter((b) => b.attendance === true).length;
  return { marked, attended, percent: marked === 0 ? null : Math.round((attended / marked) * 100) };
}

export interface ClassFrequency {
  lessonId: string;
  title: string;
  total: number; // bookings com presença marcada
  attended: number;
  percent: number | null;
}

/** Frequência por aula (turma) do professor — só aulas concluídas, mais recentes. */
export async function teacherClassFrequency(teacherId: string, take = 6): Promise<ClassFrequency[]> {
  const lessons = await prisma.lesson.findMany({
    where: { teacherId, status: "COMPLETED" },
    orderBy: { scheduledAt: "desc" },
    take,
    select: { id: true, title: true, bookings: { select: { attendance: true } } },
  });
  return lessons.map((l) => {
    const marked = l.bookings.filter((b) => b.attendance !== null);
    const attended = marked.filter((b) => b.attendance === true).length;
    return {
      lessonId: l.id,
      title: l.title,
      total: marked.length,
      attended,
      percent: marked.length === 0 ? null : Math.round((attended / marked.length) * 100),
    };
  });
}

/** Avaliação média do professor (LessonBooking.rating 1-5) + nº de avaliações. */
export async function teacherAvgRating(teacherId: string): Promise<{ avg: number | null; count: number }> {
  const agg = await prisma.lessonBooking.aggregate({
    where: { lesson: { teacherId }, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return { avg: agg._avg.rating, count: agg._count.rating };
}
