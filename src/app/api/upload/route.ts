import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdmin } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { isUnsafeCrossOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

/**
 * Upload DIRETO navegador → Vercel Blob (não passa pelo nosso servidor, então não
 * esbarra no limite de body de 3-4,5MB — ok para vídeo grande).
 *
 * Fluxo (@vercel/blob handleUpload):
 *  1. client `upload()` chama esta rota p/ gerar token → onBeforeGenerateToken (auth admin aqui)
 *  2. client envia o arquivo direto pro Blob
 *  3. Blob chama esta rota (server-to-server) p/ confirmar → verificado por assinatura
 *
 * IMPORTANTE: o proxy (src/proxy.ts) NÃO protege /api/upload — a fase 3 não tem cookie de sessão;
 * a autorização da fase 1 é feita aqui dentro (requireAdmin). Requer BLOB_READ_WRITE_TOKEN no env.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (isUnsafeCrossOriginRequest(request)) throw new ApiError(403, "Origem da requisição não permitida");
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Só admin pode gerar token de upload (a fase do client carrega o cookie de sessão).
        const session = await requireAdmin("courses");
        // Anti-abuso de custo de storage (mesmo sendo admin).
        const rl = await checkRateLimit(`upload:${session.user.id}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
        if (!rl.allowed) throw new ApiError(429, `Muitos uploads. Aguarde ${rl.retryAfter}s.`);
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-m4v"],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Sem ação: o client recebe a URL e a salva via PUT /api/units/[id].
      },
    });
    return NextResponse.json(json, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    // Auth/rate-limit → status correto; demais (ex.: token ausente) → 400 com msg + log.
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[UPLOAD]", e instanceof Error ? e.name : "UnknownError");
    return NextResponse.json({ error: "Falha no upload" }, { status: 400 });
  }
}
