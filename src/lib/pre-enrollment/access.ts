export const PRE_ENROLLMENT_PATH = "/pre-enrollments";
export const PRE_ENROLLMENT_LOGIN = "/login?mode=pre-enrollment";

function safeCallback(callback: string | null): string | null {
  if (!callback?.startsWith("/") || callback.startsWith("//") || /[\\\u0000-\u0020]/.test(callback)) return null;
  const url = new URL(callback, "https://getwise.local");
  const roots = ["/admin", "/teacher", "/student", PRE_ENROLLMENT_PATH];
  if (url.pathname !== "/" && !roots.some((root) => url.pathname === root || url.pathname.startsWith(root + "/")))
    return null;
  return url.pathname + url.search + url.hash;
}

export function isPreEnrollmentAccess(mode: string | null, callback: string | null): boolean {
  const destination = safeCallback(callback)?.split(/[?#]/)[0];
  return (
    mode === "pre-enrollment" ||
    destination === PRE_ENROLLMENT_PATH ||
    !!destination?.startsWith(PRE_ENROLLMENT_PATH + "/")
  );
}

export function loginDestination(callback: string | null, tracking: boolean): string {
  const destination = safeCallback(callback);
  if (tracking) return destination && isPreEnrollmentAccess(null, destination) ? destination : PRE_ENROLLMENT_PATH;
  return destination ?? "/";
}
