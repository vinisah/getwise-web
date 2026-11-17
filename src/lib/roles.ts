/** Roteamento por papel — fonte única usada pelo proxy (e disponível p/ outras telas). */

export const ADMIN_PATHS = ["/admin"];
export const TEACHER_PATHS = ["/teacher"];
export const STUDENT_PATHS = ["/student"];
export const AUTH_PATHS = [...ADMIN_PATHS, ...TEACHER_PATHS, ...STUDENT_PATHS, "/pre-enrollments"];

/** Home de cada papel — usado no roteamento da raiz e em redirects de papel errado. */
export function roleHome(role: string | undefined): string {
  if (role === "APPLICANT") return "/pre-enrollments";
  if (role === "ADMIN") return "/admin";
  if (role === "TEACHER") return "/teacher";
  return "/student";
}
