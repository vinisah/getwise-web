export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ padding: 24, width: "100%", color: "var(--muted)" }}>
      Carregando…
    </div>
  );
}
