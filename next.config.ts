import type { NextConfig } from "next";

// CSP em Report-Only: só reporta violações (não bloqueia), pra calibrar antes de enforce.
// 'unsafe-inline'/'unsafe-eval' cobrem estilos inline do Next e o dev do Turbopack.
// Groq é server-side → connect-src restrito a 'self'. Fontes via next/font são self-hosted.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "font-src 'self' data:",
  // upload direto pro Vercel Blob
  "connect-src 'self' https://*.blob.vercel-storage.com https://blob.vercel-storage.com",
  // vídeo direto/upload (Blob) e player de embeds
  "media-src 'self' blob: https://*.blob.vercel-storage.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,

  // Libs server-only com binários/recursos nativos → require nativo, fora do bundle do
  // Server Component (reduz o 1º compile das rotas admin/api). @prisma/client, prisma e pg
  // já saem por default do Next; aqui só as que NÃO estão na lista padrão.
  serverExternalPackages: ["@prisma/adapter-pg", "bcryptjs", "pdf-lib", "openai"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'" },
          // HTTPS forçado por 2 anos (browsers ignoram em http/localhost).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
