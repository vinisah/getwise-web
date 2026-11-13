"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./schedule.module.css";

type Lesson = {
  id: string;
  title: string;
  scheduledAt: string;
  level: string;
  maxStudents: number;
  status: string;
  teacher: { name: string };
  _count?: { bookings: number };
};
type Booking = { id: string; status: string; confirmation: string; absenceReason: string | null; lesson: Lesson };
type Schedule = {
  profile: { whatsappOptIn: boolean; level: string; cohort: { name: string } | null } | null;
  bookings: Booking[];
  available: Lesson[];
};
type AdminData = {
  canAssign: boolean;
  canPreview: boolean;
  cohorts: {
    id: string;
    name: string;
    level: string;
    capacity: number;
    _count: { students: number; lessons: number };
  }[];
  students: { id: string; name: string; studentProfile: { level: string; cohortId: string | null } | null }[];
  teachers: { id: string; name: string }[];
};
const labels: Record<string, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmada",
  DECLINED: "Ausência justificada",
  RESCHEDULED: "Remarcada",
};
const format = (date: string) =>
  new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function SchedulePanel({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Schedule | null>(null);
  const [management, setManagement] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [day, setDay] = useState("");
  const inFlight = useRef(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const response = await fetch("/api/scheduling" + (admin ? "?admin=true" : ""), {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => {
      throw new Error("Não foi possível ler a agenda. Tente atualizar novamente.");
    });
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar a agenda");
    if (version === loadVersion.current) {
      if (admin) setManagement(result);
      else {
        setData(result);
        setSelected((current) =>
          current
            ? (result.bookings.find(
                (b: Booking) =>
                  b.id === current.id && b.confirmation !== "RESCHEDULED" && b.lesson.status === "SCHEDULED"
              ) ?? null)
            : null
        );
      }
    }
    return result as Schedule & AdminData;
  }, [admin]);
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    const refresh = () => {
      if (!inFlight.current && document.visibilityState === "visible") {
        void load().catch(() =>
          setMessage("Não foi possível atualizar a agenda. Confira sua conexão e tente novamente.")
        );
      }
    };
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      ++loadVersion.current;
    };
  }, [load]);
  async function act(body: object) {
    if (inFlight.current) return;
    inFlight.current = true;
    ++loadVersion.current;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/scheduling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        // A última vaga pode ter sido ocupada depois da listagem.
        await load().catch(() => {});
        throw new Error(result?.error || "Não foi possível salvar. Atualize a agenda antes de tentar novamente.");
      }
      if ("action" in body && body.action === "preview") {
        window.location.assign("/student/agenda");
        return;
      }
      // Reflete a gravação confirmada mesmo se a consulta seguinte perder a conexão.
      if ("action" in body && "bookingId" in body) {
        const action = body.action;
        setData((current) =>
          current
            ? {
                ...current,
                bookings: current.bookings.map((booking) =>
                  booking.id !== body.bookingId
                    ? booking
                    : {
                        ...booking,
                        status: action === "confirm" ? "SCHEDULED" : "CANCELLED",
                        confirmation:
                          action === "confirm" ? "CONFIRMED" : action === "decline" ? "DECLINED" : "RESCHEDULED",
                        absenceReason:
                          action === "confirm" ? null : action === "decline" ? reason : booking.absenceReason,
                      }
                ),
              }
            : current
        );
      }
      if ("lessonId" in body)
        setData((current) =>
          current
            ? { ...current, available: current.available.filter((lesson) => lesson.id !== body.lessonId) }
            : current
        );
      if ("action" in body && body.action === "decline" && selected)
        setSelected({ ...selected, status: "CANCELLED", confirmation: "DECLINED", absenceReason: reason });
      else setSelected(null);
      setReason("");
      try {
        await load();
        setMessage("Agenda atualizada.");
      } catch {
        setMessage(
          "Alteração salva. Não foi possível recarregar a agenda; clique em Atualizar agenda. Não é necessário repetir a operação."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error && !["TypeError", "TimeoutError", "AbortError"].includes(error.name)
          ? error.message
          : "Falha de conexão. Atualize a agenda para conferir se a alteração foi salva antes de tentar novamente."
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const alternatives =
    data?.available.filter(
      (lesson) =>
        (!day || new Date(lesson.scheduledAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) === day) &&
        lesson.id !== selected?.lesson.id
    ) ?? [];
  return (
    <section className={styles.panel}>
      <header>
        <h1>{admin ? "Turmas e agenda pedagógica" : "Minha agenda"}</h1>
        <p>
          {admin
            ? "Defina o nível, a capacidade e os encontros semanais de cada turma."
            : "Confirme sua participação ou escolha outro encontro do seu nível."}
        </p>
      </header>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void load()
            .then(() => setMessage("Agenda atualizada."))
            .catch((error) => setMessage(error.message));
        }}
      >
        Atualizar agenda
      </button>
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {admin && management ? (
        <>
          <form
            className={styles.card}
            onSubmit={(event) => {
              event.preventDefault();
              const fields = Object.fromEntries(new FormData(event.currentTarget));
              void act({
                ...fields,
                startsAt: String(fields.startsAt) + "-03:00",
                action: "createCohort",
              });
            }}
          >
            <h2>Nova turma</h2>
            <div className={styles.grid}>
              <label>
                Nome da turma
                <input name="name" required minLength={2} placeholder="A1 · Terças à noite" />
              </label>
              <label>
                Nível
                <select name="level">
                  {["A1", "A2", "A3"].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label>
                Professor mentor
                <select name="teacherId" required>
                  <option value="">Selecione</option>
                  {management.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Conteúdo dos encontros
                <input name="title" required minLength={2} placeholder="Conversação e prática" />
              </label>
              <label>
                Primeiro encontro (Brasília)
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                Quantidade de semanas
                <input type="number" name="weeks" min={1} max={104} defaultValue={12} required />
              </label>
              <label>
                Vagas por turma
                <input type="number" name="capacity" min={1} max={100} defaultValue={8} required />
              </label>
              <label>
                Duração em minutos
                <input type="number" name="duration" min={15} max={180} defaultValue={50} required />
              </label>
            </div>
            <button disabled={busy}>Criar turma e agenda semanal</button>
          </form>
          <div className={styles.grid}>
            {management.cohorts.map((cohort) => (
              <article className={styles.card} key={cohort.id}>
                <h2>{cohort.name}</h2>
                <p>
                  {cohort.level} · {cohort._count.students}/{cohort.capacity} alunos · {cohort._count.lessons} encontros
                </p>
              </article>
            ))}
          </div>
          <section className={styles.card}>
            <h2>Alunos e turma fixa</h2>
            {management.students.map((student) => (
              <div key={student.id} className={styles.row}>
                <span>
                  {student.name} · {student.studentProfile?.level ?? "Sem nível"}
                </span>
                {student.studentProfile?.cohortId ? (
                  <span>{management.cohorts.find((c) => c.id === student.studentProfile?.cohortId)?.name}</span>
                ) : management.canAssign ? (
                  <button
                    disabled={busy || !student.studentProfile}
                    onClick={() => act({ action: "assign", studentId: student.id })}
                  >
                    Alocar em turma do mesmo nível
                  </button>
                ) : (
                  <span>Aguardando alocação pela equipe autorizada</span>
                )}
                {management.canPreview && (
                  <button disabled={busy} onClick={() => act({ action: "preview", studentId: student.id })}>
                    Ver agenda do aluno
                  </button>
                )}
              </div>
            ))}
          </section>
        </>
      ) : !admin && data ? (
        <>
          <p className={styles.notice}>
            {data.profile?.cohort
              ? "Turma fixa · " + data.profile.cohort.name
              : "A equipe pedagógica ainda precisa definir sua turma."}{" "}
            · Nível {data.profile?.level}
          </p>
          <label>
            <input
              type="checkbox"
              checked={data.profile?.whatsappOptIn ?? false}
              disabled={busy}
              onChange={(event) => act({ action: "whatsappConsent", enabled: event.target.checked })}
            />
            Quero receber lembretes e responder sobre minhas aulas pelo WhatsApp cadastrado.
          </label>
          {!data.bookings.length && <p>Nenhum encontro agendado.</p>}
          <div className={styles.grid}>
            {data.bookings.map((booking) => (
              <article className={styles.card} key={booking.id}>
                <span>
                  {booking.lesson.level} ·{" "}
                  {booking.lesson.status === "CANCELLED"
                    ? "Aula cancelada pela escola"
                    : booking.lesson.status === "COMPLETED"
                      ? "Aula concluída"
                      : booking.lesson.status === "IN_PROGRESS"
                        ? "Aula em andamento"
                        : labels[booking.confirmation]}
                </span>
                <h2>{booking.lesson.title}</h2>
                <p>{format(booking.lesson.scheduledAt)}</p>
                <p>Mentor · {booking.lesson.teacher.name}</p>
                {booking.absenceReason && <p>Justificativa · {booking.absenceReason}</p>}
                {booking.confirmation !== "RESCHEDULED" &&
                  booking.lesson.status === "SCHEDULED" &&
                  new Date(booking.lesson.scheduledAt).getTime() > Date.now() && (
                    <div className={styles.actions}>
                      {booking.confirmation !== "CONFIRMED" && (
                        <button disabled={busy} onClick={() => act({ action: "confirm", bookingId: booking.id })}>
                          Confirmar participação
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(booking);
                          setReason("");
                          setDay("");
                          setMessage("");
                        }}
                      >
                        {booking.confirmation === "DECLINED" ? "Escolher outro horário" : "Não posso participar"}
                      </button>
                    </div>
                  )}
              </article>
            ))}
          </div>
          <section className={styles.card}>
            <h2>Outras aulas do meu nível</h2>
            {data.available.length ? (
              data.available.map((lesson) => (
                <div className={styles.row} key={lesson.id}>
                  <span>
                    {format(lesson.scheduledAt)} · {lesson.title} · {lesson.teacher.name}
                  </span>
                  <button disabled={busy} onClick={() => act({ action: "book", lessonId: lesson.id })}>
                    Participar
                  </button>
                </div>
              ))
            ) : (
              <p>Nenhuma outra aula com vagas no período do seu curso.</p>
            )}
          </section>
          {selected && (
            <dialog
              className={styles.dialog}
              ref={(node) => {
                if (node && !node.open) node.showModal();
              }}
              onCancel={(event) => {
                if (busy) event.preventDefault();
                else setSelected(null);
              }}
              aria-label="Remarcar aula"
            >
              <div className={styles.row}>
                <h2>Remarcar encontro</h2>
                <button disabled={busy} onClick={() => setSelected(null)}>
                  Fechar
                </button>
              </div>
              {message && (
                <p role="status" className={styles.notice}>
                  {message}
                </p>
              )}
              {selected.confirmation !== "DECLINED" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act({ action: "decline", bookingId: selected.id, reason });
                  }}
                >
                  <label>
                    Justificativa
                    <textarea
                      required
                      minLength={2}
                      maxLength={1000}
                      value={reason}
                      disabled={busy}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Registrar ausência</button>
                </form>
              ) : (
                <>
                  <label>
                    Melhor dia
                    <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
                  </label>
                  {alternatives.length ? (
                    alternatives.map((lesson) => (
                      <div className={styles.row} key={lesson.id}>
                        <span>
                          {format(lesson.scheduledAt)} · {lesson.title} ·{" "}
                          {lesson.maxStudents - (lesson._count?.bookings ?? 0)} vagas
                        </span>
                        <button
                          disabled={busy}
                          onClick={() => act({ action: "reschedule", bookingId: selected.id, lessonId: lesson.id })}
                        >
                          Reservar
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>
                      Sem aulas disponíveis neste dia. Seus próximos encontros da agenda pedagógica continuam agendados.
                    </p>
                  )}
                </>
              )}
            </dialog>
          )}
        </>
      ) : (
        !message && <p role="status">Carregando agenda…</p>
      )}
    </section>
  );
}
