import { useStore } from "../state/store";

export function RaceChart() {
  const scene = useStore((s) => s.scene);
  const progress = useStore((s) => s.progress);
  if (!scene || scene.mode !== "race" || !scene.race) return null;
  const r = scene.race;
  const maxN = Math.max(r.aNodes, r.bNodes, 1);
  // reveal the bars in step with the animation
  const aShown = Math.round(Math.min(1, progress) * r.aNodes);
  const bShown = Math.round(Math.min(1, progress) * r.bNodes);

  return (
    <div className="racechart glass">
      <div className="panel-head">
        <span className="cap">NODES EXPLORED · RUNTIME</span>
        <span className="algo-tag" style={{ color: "var(--ok)" }}>
          A★ ↓ {r.speedup.toFixed(1)}× FEWER
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <Bar label="DIJKSTRA" color="var(--algo-a)" nodes={aShown} ms={r.aMs} frac={aShown / maxN} />
        <Bar label="A★" color="var(--algo-b)" nodes={bShown} ms={r.bMs} frac={bShown / maxN} />
      </div>
    </div>
  );
}

function Bar({ label, color, nodes, ms, frac }: { label: string; color: string; nodes: number; ms: number; frac: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-cap)", color: "var(--ink-muted)" }}>
          {nodes.toLocaleString("en-US")} · {ms.toFixed(1)}ms
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </div>
  );
}
