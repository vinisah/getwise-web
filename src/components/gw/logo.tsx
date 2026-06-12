import Image from "next/image";

interface LogoProps {
  variant?: "full" | "icon";
  height?: number;
  white?: boolean;
  style?: React.CSSProperties;
}

export function Logo({ variant = "full", height = 34, white = false, style }: LogoProps) {
  if (variant === "icon") {
    // Coruja colorida (fundo claro) ou branca (fundo escuro)
    const src = white ? "/logo-icon-white.png" : "/logo-icon.png";
    return (
      <Image
        src={src}
        alt="Get Wise"
        height={height}
        width={height}
        style={{ objectFit: "contain", ...style }}
        priority
      />
    );
  }

  // Versão full: logo completa com texto
  const src = white ? "/logo-white.png" : "/logo-full.png";
  // Proporção aproximada das imagens (largura ≈ 3× altura)
  const width = Math.round(height * 3);
  return (
    <Image
      src={src}
      alt="Get Wise — Speak English"
      height={height}
      width={width}
      style={{ objectFit: "contain", ...style }}
      priority
    />
  );
}
