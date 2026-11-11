import { getCachedSession } from "@/lib/effective-user";

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LessonEditForm } from "./lesson-edit-form";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) notFound();

  // Mesma convenção do cadastro/lista: wall-clock no fuso do runtime (Node). getTimezoneOffset
  // adapta automaticamente (dev Brasília = -180; Vercel = UTC = 0). O form reenvia a string crua
  // e o PATCH faz new Date(string) no mesmo fuso → abre+salva preserva a hora (sem drift).
  const sa = lesson.scheduledAt;
  const scheduledAtLocal = new Date(sa.getTime() - sa.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <LessonEditForm
      lesson={{
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        scheduledAtLocal,
        duration: lesson.duration,
        meetingUrl: lesson.meetingUrl,
        level: lesson.level,
      }}
    />
  );
}
