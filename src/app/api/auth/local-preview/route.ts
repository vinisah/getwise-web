import { NextResponse } from "next/server";
import { localDemoEnabled } from "@/lib/auth";
export async function GET(req: Request) {
  return NextResponse.json(
    { enabled: localDemoEnabled() && ["127.0.0.1", "localhost"].includes(new URL(req.url).hostname) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
