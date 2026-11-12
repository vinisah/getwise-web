import { getCachedSession } from "@/lib/effective-user";

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LessonEditForm } from "./lesson-edit-form";
import { schoolDateTimeInput } from "@/lib/scheduling/dates";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) notFound();

  const scheduledAtLocal = schoolDateTimeInput(lesson.scheduledAt);

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
