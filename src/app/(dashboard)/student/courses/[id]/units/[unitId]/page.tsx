import { redirect, notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/effective-user";
import { roleHome } from "@/lib/roles";
import { isCourseUnlocked, getOrderedUnits, getCompletedUnitIds, isUnitUnlocked } from "@/lib/services/unlock";
import { touchUnitAccess } from "@/lib/services/progress";
import { Card, SectionHeader } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { CompleteButton } from "./complete-button";
import { VideoPlayer } from "./video-player";
import { ExerciseRunner } from "./exercise-runner";
import { MaterialList } from "./material-list";

export default async function UnitPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  // effective user: aluno real OU admin "vendo como" aluno (read-only).
  const eff = await getEffectiveUser();
  if (!eff) redirect("/login");
  if (eff.role !== "STUDENT") redirect(roleHome(eff.role));
  const user = { id: eff.id, role: eff.role as string };

  const { id: courseId, unitId } = await params;

  // Tudo independente entre si → uma única ida ao banco (em vez de 5 em série).
  // vp também: depende só de userId+unitId (já conhecidos); usado só se hasVideo.
  const [unit, ordered, completed, courseUnlocked, vp] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        module: { include: { course: true } },
        exercises: { where: { isActive: true }, orderBy: { order: "asc" } },
        materials: { orderBy: { createdAt: "asc" } },
      },
    }),
    getOrderedUnits(courseId),
    getCompletedUnitIds(user.id, courseId),
    isCourseUnlocked(user.id, courseId),
    prisma.unitVideoProgress.findUnique({ where: { userId_unitId: { userId: user.id, unitId } } }),
  ]);
  if (!unit || unit.module.courseId !== courseId) notFound();
  if (user.role === "STUDENT" && !unit.module.course.isActive) notFound(); // curso arquivado

  // Guards de bloqueio (aluno) — funções puras sobre os dados já carregados
  const unitUnlocked = isUnitUnlocked(unitId, ordered, completed);

  if (user.role === "STUDENT" && (!courseUnlocked || !unitUnlocked)) {
    redirect(`/student/courses/${courseId}`);
  }

  // Registro de acesso é write — fora do caminho crítico de render (após resposta).
  if (user.role === "STUDENT") {
    after(() => touchUnitAccess(user.id, unitId, courseId));
  }

  const isDone = completed.has(unitId);
  const idx = ordered.findIndex((u) => u.id === unitId);

  const hasVideo = (unit.type === "VIDEO" || unit.type === "MIXED") && !!unit.videoUrl;
  const hasReading = unit.type === "READING" || unit.type === "MIXED" || !unit.videoUrl;
  const requiredExercises = unit.exercises.filter((e) => e.isRequired);
  const videoWatched = (vp?.watchedPercent ?? 0) >= 90;
  const exercisesLocked = hasVideo && !videoWatched;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", maxWidth: 800 }}>
      <Link href={`/student/courses/${courseId}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={15} /> {unit.module.course.title}
        </Button>
      </Link>

      <Card style={{ padding: 32 }}>
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--mono)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {unit.module.title} · Unidade {idx + 1} de {ordered.length}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", marginTop: 8 }}>
          {unit.title}
        </h1>

        {hasVideo && (
          <div style={{ marginTop: 20 }}>
            <VideoPlayer
              unitId={unitId}
              videoUrl={unit.videoUrl!}
              initialPosition={vp?.positionSeconds ?? 0}
              initialPercent={vp?.watchedPercent ?? 0}
              watermark={`${eff.name} · ${eff.id.slice(-6)}`}
            />
          </div>
        )}

        {hasReading && unit.content && (
          <div style={{ marginTop: 24, fontSize: 15, lineHeight: 1.7, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
            {unit.content}
          </div>
        )}
      </Card>

      {/* Materiais (PDF) */}
      {unit.materials.length > 0 && (
        <Card>
          <SectionHeader title="Materiais" sub="Downloads complementares" />
          <MaterialList materials={unit.materials.map((m) => ({ id: m.id, fileName: m.fileName }))} />
        </Card>
      )}

      {/* Exercícios */}
      {unit.exercises.length > 0 && (
        <div>
          <SectionHeader
            title="Exercícios"
            sub={
              requiredExercises.length > 0
                ? `${requiredExercises.length} obrigatório(s) para concluir`
                : "Pratique para fixar"
            }
          />
          <ExerciseRunner
            exercises={unit.exercises.map((e) => ({
              id: e.id,
              title: e.title,
              type: e.type,
              points: e.points,
              isRequired: e.isRequired,
              content: e.content as Record<string, unknown>,
            }))}
            locked={exercisesLocked}
          />
        </div>
      )}

      {/* Conclusão manual (apenas units sem exercícios obrigatórios) */}
      {requiredExercises.length === 0 && (
        <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FileText size={18} color="var(--muted)" />
          <span style={{ flex: 1, fontSize: 13.5, color: "var(--muted)" }}>
            {hasVideo ? "Assista 90% do vídeo e marque como concluída." : "Leu tudo? Marque como concluída."}
          </span>
          <CompleteButton unitId={unitId} courseId={courseId} alreadyDone={isDone} />
        </Card>
      )}
    </div>
  );
}
