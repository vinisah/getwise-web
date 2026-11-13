"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarX2,
  Check,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Clock3,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Repeat2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Avatar, Badge, Card, TONES } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
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

function BookingStatus({ booking }: { booking: Booking }) {
  const status = booking.lesson.status === "SCHEDULED" ? booking.confirmation : booking.lesson.status;
  const presentation: Record<string, { label: string; tone: string; icon: typeof Clock3 }> = {
    PENDING: { label: labels.PENDING, tone: "amber", icon: Clock3 },
    CONFIRMED: { label: labels.CONFIRMED, tone: "green", icon: CircleCheck },
    DECLINED: { label: labels.DECLINED, tone: "red", icon: CircleMinus },
    RESCHEDULED: { label: labels.RESCHEDULED, tone: "slate", icon: Repeat2 },
    CANCELLED: { label: "Aula cancelada pela escola", tone: "red", icon: CircleMinus },
    COMPLETED: { label: "Aula concluída", tone: "green", icon: CircleCheck },
    IN_PROGRESS: { label: "Aula em andamento", tone: "amber", icon: Clock3 },
  };
  const item = presentation[status] ?? presentation.PENDING;
  const Icon = item.icon;
  return (
    <Badge tone={item.tone} style={{ color: `color-mix(in srgb, ${TONES[item.tone].fg} 75%, var(--ink))` }}>
      <Icon size={13} aria-hidden="true" /> {item.label}
    </Badge>
  );
}

function LessonDate({ date }: { date: string }) {
  const value = new Date(date);
  const formatPart = (options: Intl.DateTimeFormatOptions) =>
    value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...options });
  return (
    <time dateTime={date} className={styles.lessonDate}>
      <span className={styles.dateTile} aria-hidden="true">
        <strong>{formatPart({ day: "2-digit" })}</strong>
        <span>{formatPart({ month: "short" }).replace(".", "")}</span>
      </span>
      <span>
        <span className={styles.dateTitle}>
          {formatPart({ weekday: "long" })} · {formatPart({ hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className={styles.secondary}>
          {formatPart({ day: "numeric", month: "long", year: "numeric" })} · Brasília
        </span>
      </span>
    </time>
  );
}

function ScheduleNotice({ message }: { message: string }) {
  const saved = message === "Agenda atualizada.";
  const partial = message.startsWith("Alteração salva.");
  const Icon = saved ? CircleCheck : CircleAlert;
  return (
    <div
      className={`${styles.notice} ${saved ? styles.noticeSuccess : partial ? styles.noticeWarning : styles.noticeError}`}
      role={saved || partial ? "status" : "alert"}
    >
      <Icon size={17} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

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
    <section className={styles.panel} aria-label={admin ? "Turmas e agenda pedagógica" : "Minha agenda"}>
      <div className={styles.toolbar}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            void load()
              .then(() => setMessage("Agenda atualizada."))
              .catch((error) => setMessage(error.message));
          }}
        >
          <RefreshCw size={15} aria-hidden="true" /> Atualizar agenda
        </Button>
      </div>
      {message && !selected && <ScheduleNotice message={message} />}
      {admin && management ? (
        <>
          <form
            className={`gw-card ${styles.card}`}
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
            <div className={styles.sectionHeader}>
              <div className={styles.headingGroup}>
                <span className={styles.headingIcon}>
                  <Users size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>Nova turma</h2>
                  <p className={styles.secondary}>Defina o nível, o mentor e os encontros semanais.</p>
                </div>
              </div>
              <Badge tone="slate">Agenda recorrente</Badge>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Nome da turma
                <Input name="name" required minLength={2} placeholder="A1 · Terças à noite" />
              </label>
              <label className={styles.field}>
                Nível
                <select name="level">
                  {["A1", "A2", "A3"].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
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
              <label className={styles.field}>
                Conteúdo dos encontros
                <Input name="title" required minLength={2} placeholder="Conversação e prática" />
              </label>
              <label className={styles.field}>
                Primeiro encontro (Brasília)
                <Input type="datetime-local" name="startsAt" required />
              </label>
              <label className={styles.field}>
                Quantidade de semanas
                <Input type="number" name="weeks" min={1} max={104} defaultValue={12} required />
              </label>
              <label className={styles.field}>
                Vagas por turma
                <Input type="number" name="capacity" min={1} max={100} defaultValue={8} required />
              </label>
              <label className={styles.field}>
                Duração em minutos
                <Input type="number" name="duration" min={15} max={180} defaultValue={50} required />
              </label>
            </div>
            <div className={styles.formFooter}>
              <span className={styles.meta}>
                <Repeat2 size={16} aria-hidden="true" /> Encontros semanais, no mesmo horário
              </span>
              <Button type="submit" variant="accent" disabled={busy}>
                <Plus size={17} aria-hidden="true" /> Criar turma e agenda semanal
              </Button>
            </div>
          </form>
          <section className={styles.section} aria-labelledby="cohorts-heading">
            <div className={styles.sectionLabel}>
              <h2 id="cohorts-heading">Turmas cadastradas</h2>
              <Badge tone="slate">
                {management.cohorts.length} {management.cohorts.length === 1 ? "turma" : "turmas"}
              </Badge>
            </div>
            {management.cohorts.length ? (
              <div className={styles.grid}>
                {management.cohorts.map((cohort) => {
                  const count = cohort._count.students;
                  const available = Math.max(0, cohort.capacity - count);
                  const percent = cohort.capacity > 0 ? Math.min(100, (count / cohort.capacity) * 100) : 0;
                  return (
                    <Card key={cohort.id} className={styles.card}>
                      <div className={styles.cardMeta}>
                        <Badge tone="blue">{cohort.level}</Badge>
                        <span className={styles.secondary}>{cohort._count.lessons} encontros</span>
                      </div>
                      <h3 className={styles.cohortName}>{cohort.name}</h3>
                      <div className={styles.capacity}>
                        <strong>
                          {count}/{cohort.capacity} alunos
                        </strong>
                        <span>
                          {available === 0
                            ? "Turma completa"
                            : `${available} ${available === 1 ? "vaga livre" : "vagas livres"}`}
                        </span>
                      </div>
                      <div
                        className="gw-meter"
                        role="meter"
                        aria-label={`Ocupação de ${cohort.name}`}
                        aria-valuemin={0}
                        aria-valuemax={cohort.capacity}
                        aria-valuenow={count}
                        aria-valuetext={`${count} de ${cohort.capacity} vagas ocupadas`}
                      >
                        <span
                          style={{ width: `${percent}%`, background: available ? "var(--accent)" : "var(--amber)" }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className={`${styles.card} ${styles.empty}`}>
                <Users size={26} aria-hidden="true" />
                <h3>Nenhuma turma cadastrada</h3>
                <p>Crie a primeira turma no formulário acima.</p>
              </Card>
            )}
          </section>
          <Card className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Alunos e turma fixa</h2>
                <p className={styles.secondary}>Alocação por nível e acesso à agenda individual.</p>
              </div>
            </div>
            {management.students.length ? (
              management.students.map((student) => (
                <div key={student.id} className={`${styles.row} ${styles.studentRow}`}>
                  <div className={styles.person}>
                    <Avatar initials={getInitials(student.name)} size={34} tone="brand" />
                    <div>
                      <strong>{student.name}</strong>
                      <p className={styles.secondary}>
                        {student.studentProfile?.level ? `Nível ${student.studentProfile.level}` : "Sem nível"}
                      </p>
                    </div>
                  </div>
                  <div className={styles.assignment}>
                    {student.studentProfile?.cohortId ? (
                      <Badge tone="slate">
                        {management.cohorts.find((c) => c.id === student.studentProfile?.cohortId)?.name}
                      </Badge>
                    ) : management.canAssign ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={styles.softButton}
                        disabled={busy || !student.studentProfile}
                        onClick={() => act({ action: "assign", studentId: student.id })}
                      >
                        <UserPlus size={15} aria-hidden="true" /> Alocar em turma do mesmo nível
                      </Button>
                    ) : (
                      <span className={styles.secondary}>Aguardando alocação pela equipe autorizada</span>
                    )}
                  </div>
                  {management.canPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.linkButton}
                      disabled={busy}
                      onClick={() => act({ action: "preview", studentId: student.id })}
                    >
                      Ver agenda do aluno <ArrowUpRight size={15} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className={styles.secondary}>Nenhum aluno cadastrado.</p>
            )}
          </Card>
        </>
      ) : !admin && data ? (
        <>
          <div className={styles.cohortContext}>
            <div className={styles.headingGroup}>
              <Users size={20} aria-hidden="true" />
              <div>
                <span className={styles.eyebrow}>Turma fixa</span>
                <p className={styles.contextName}>
                  {data.profile?.cohort?.name ?? "A equipe pedagógica ainda precisa definir sua turma."}
                </p>
              </div>
            </div>
            {data.profile?.level && <Badge tone="blue">Nível {data.profile.level}</Badge>}
          </div>
          <Card className={styles.consent}>
            <label className={styles.consentLabel}>
              <input
                type="checkbox"
                checked={data.profile?.whatsappOptIn ?? false}
                disabled={busy}
                onChange={(event) => act({ action: "whatsappConsent", enabled: event.target.checked })}
              />
              <span>
                <strong>Lembretes pelo WhatsApp</strong>
                <span className={styles.secondary}>
                  Quero receber lembretes e responder sobre minhas aulas pelo WhatsApp cadastrado.
                </span>
              </span>
            </label>
            <MessageCircle size={20} aria-hidden="true" />
          </Card>
          <section className={styles.section} aria-labelledby="bookings-heading">
            <h2 id="bookings-heading">Próximos encontros</h2>
            {!data.bookings.length && (
              <Card className={`${styles.card} ${styles.empty}`}>
                <CalendarDays size={26} aria-hidden="true" />
                <h3>Nenhum encontro agendado.</h3>
                <p>Seus encontros aparecerão aqui após a alocação na turma.</p>
              </Card>
            )}
            <div className={styles.grid}>
              {data.bookings.map((booking) => (
                <Card className={`${styles.card} ${styles.booking}`} key={booking.id}>
                  <div className={styles.cardMeta}>
                    <Badge tone="slate">{booking.lesson.level}</Badge>
                    <BookingStatus booking={booking} />
                  </div>
                  <LessonDate date={booking.lesson.scheduledAt} />
                  <h3>{booking.lesson.title}</h3>
                  <p className={styles.meta}>
                    <UserRound size={15} aria-hidden="true" /> Mentor · {booking.lesson.teacher.name}
                  </p>
                  {booking.absenceReason && <p className={styles.secondary}>Justificativa · {booking.absenceReason}</p>}
                  {booking.confirmation !== "RESCHEDULED" &&
                    booking.lesson.status === "SCHEDULED" &&
                    new Date(booking.lesson.scheduledAt).getTime() > Date.now() && (
                      <div className={styles.bookingActions}>
                        {booking.confirmation !== "CONFIRMED" && (
                          <Button
                            type="button"
                            variant="accent"
                            size="sm"
                            disabled={busy}
                            onClick={() => act({ action: "confirm", bookingId: booking.id })}
                          >
                            <Check size={16} aria-hidden="true" /> Confirmar participação
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setSelected(booking);
                            setReason("");
                            setDay("");
                            setMessage("");
                          }}
                        >
                          {booking.confirmation === "DECLINED" ? "Escolher outro horário" : "Não posso participar"}
                        </Button>
                      </div>
                    )}
                </Card>
              ))}
            </div>
          </section>
          <Card className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Outras aulas do meu nível</h2>
                <p className={styles.secondary}>Encontros com vagas no período do seu curso.</p>
              </div>
              {data.profile?.level && <Badge tone="slate">{data.profile.level}</Badge>}
            </div>
            {data.available.length ? (
              data.available.map((lesson) => (
                <div className={styles.row} key={lesson.id}>
                  <div className={styles.lessonSummary}>
                    <strong>{format(lesson.scheduledAt)}</strong>
                    <p className={styles.secondary}>
                      {lesson.title} · {lesson.teacher.name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.softButton}
                    disabled={busy}
                    onClick={() => act({ action: "book", lessonId: lesson.id })}
                  >
                    <Plus size={16} aria-hidden="true" /> Participar
                  </Button>
                </div>
              ))
            ) : (
              <p className={styles.secondary}>Nenhuma outra aula com vagas no período do seu curso.</p>
            )}
          </Card>
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
              aria-describedby="reschedule-description"
            >
              <div className={styles.sectionHeader}>
                <h2>Remarcar encontro</h2>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setSelected(null)}>
                  <X size={16} aria-hidden="true" /> Fechar
                </Button>
              </div>
              <ol className={styles.steps} aria-label="Etapas da remarcação">
                <li aria-current={selected.confirmation !== "DECLINED" ? "step" : undefined}>
                  1 · Justificar ausência
                </li>
                <li aria-current={selected.confirmation === "DECLINED" ? "step" : undefined}>2 · Escolher horário</li>
              </ol>
              <p id="reschedule-description" className={styles.secondary}>
                {selected.lesson.title} · {format(selected.lesson.scheduledAt)}
              </p>
              {message && <ScheduleNotice message={message} />}
              {selected.confirmation !== "DECLINED" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act({ action: "decline", bookingId: selected.id, reason });
                  }}
                >
                  <label className={styles.field}>
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
                  <div className={styles.formFooter}>
                    <p className={styles.secondary}>Depois, escolha outro encontro do mesmo nível.</p>
                    <Button type="submit" variant="accent" disabled={busy}>
                      Registrar ausência
                    </Button>
                  </div>
                </form>
              ) : (
                <div className={styles.section}>
                  <label className={styles.field}>
                    Melhor dia
                    <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
                  </label>
                  {alternatives.length ? (
                    alternatives.map((lesson) => (
                      <div className={styles.row} key={lesson.id}>
                        <div className={styles.lessonSummary}>
                          <strong>{format(lesson.scheduledAt)}</strong>
                          <p className={styles.secondary}>
                            {lesson.title} · {lesson.maxStudents - (lesson._count?.bookings ?? 0)} vagas
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="accent"
                          size="sm"
                          disabled={busy}
                          onClick={() => act({ action: "reschedule", bookingId: selected.id, lessonId: lesson.id })}
                        >
                          Reservar
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className={styles.empty}>
                      <CalendarX2 size={26} aria-hidden="true" />
                      <p>
                        Sem aulas disponíveis neste dia. Seus próximos encontros da agenda pedagógica continuam
                        agendados.
                      </p>
                    </div>
                  )}
                  <p className={styles.secondary}>A remarcação mantém sua turma fixa e altera apenas este encontro.</p>
                </div>
              )}
            </dialog>
          )}
        </>
      ) : (
        !message && (
          <div role="status" className={styles.loading}>
            <LoaderCircle size={20} className={styles.spinner} aria-hidden="true" /> Carregando agenda…
          </div>
        )
      )}
    </section>
  );
}
