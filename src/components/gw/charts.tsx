export function Sparkline({ data, color, height = 34 }: { data: number[]; color: string; height?: number }) {
  const w = 120,
    h = height,
    max = Math.max(...data),
    min = Math.min(...data);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / (max - min || 1)) * (h - 4) - 2;
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const id = "sp" + color.replace(/[^a-z0-9]/gi, "");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, marginTop: 12, display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.16" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarChart({ data, height = 200 }: { data: { m: string; in: number; out: number }[]; height?: number }) {
  const max = Math.max(...data.flatMap((d) => [d.in, d.out]), 1) * 1.12;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height, paddingTop: 8 }}>
      {data.map((d) => (
        <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: "100%", width: "100%", justifyContent: "center" }}>
            <div className="gw-bar" style={{ width: 13, height: `${(d.in / max) * 100}%`, background: "var(--accent)", borderRadius: "5px 5px 0 0" }} title={`Receita ${d.in}k`} />
            <div className="gw-bar" style={{ width: 13, height: `${(d.out / max) * 100}%`, background: "var(--line)", borderRadius: "5px 5px 0 0" }} title={`Despesa ${d.out}k`} />
          </div>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{d.m}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  data,
  size = 168,
  thickness = 22,
  centerLabel = "matrículas",
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" style={{ fontFamily: "var(--sans)", fontWeight: 800, fontSize: 30, fill: "var(--ink)" }}>
        {data.reduce((s, d) => s + d.value, 0)}
      </text>
      <text x="50%" y="59%" textAnchor="middle" style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, fill: "var(--muted)" }}>
        {centerLabel}
      </text>
    </svg>
  );
}

export function Ring({
  value,
  size = 116,
  thickness = 11,
  color = "var(--accent)",
  label,
  sub,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label: string;
  sub?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{sub}</span>}
      </div>
    </div>
  );
}
