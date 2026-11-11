/** Proteção de escrita por cookie; webhooks sem cookies mantêm sua autenticação própria. */
export function isUnsafeCrossOriginRequest(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) {
    // Clientes não navegador que usam cookie precisam enviar Origin também.
    return req.headers.has("cookie") && site !== "same-origin";
  }
  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.NEXTAUTH_URL) {
    try { allowed.add(new URL(process.env.NEXTAUTH_URL).origin); } catch { /* inválido não libera origem */ }
  }
  return !allowed.has(origin);
}
