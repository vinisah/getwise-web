import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PREFS_COOKIE, THEMES, parsePrefsCookie, themeVars } from "@/lib/theme";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spline = Spline_Sans_Mono({
  variable: "--font-spline",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Get Wise — Speak English",
  description: "Sistema de gestão de aulas de inglês Get Wise",
};

// theme-color (chrome do navegador/PWA) acompanha o tema escolhido (mesmo cookie do <html>).
export async function generateViewport(): Promise<Viewport> {
  const prefs = parsePrefsCookie((await cookies()).get(PREFS_COOKIE)?.value);
  return { themeColor: THEMES[prefs.theme].brand, viewportFit: "cover", interactiveWidget: "resizes-content" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tema vem do cookie no servidor → aplicado inline no <html> (sem flash de tema).
  const prefs = parsePrefsCookie((await cookies()).get(PREFS_COOKIE)?.value);
  const style = themeVars(prefs) as React.CSSProperties;

  return (
    <html lang="pt-BR" data-motion={prefs.motion} className={`${hanken.variable} ${spline.variable}`} style={style}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
