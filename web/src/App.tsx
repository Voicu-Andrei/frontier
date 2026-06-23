import { useEffect } from "react";
import { useStore } from "./state/store";
import { GRAPH_URLS } from "./config";
import { MapCanvas } from "./map/MapCanvas";
import { TopBar } from "./ui/TopBar";
import { Hud } from "./ui/Hud";
import { Scrubber } from "./ui/Scrubber";
import { RaceChart } from "./ui/RaceChart";
import { TokensDrawer } from "./ui/TokensDrawer";

const HINTS: Record<string, string> = {
  start: "Click the map to set the start",
  end: "Click the map to set the destination",
  iso: "Click to move the origin",
  multi: "Click to move the first stop",
  dispatch: "Click to drop a call",
};

export function App() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);
  const scene = useStore((s) => s.scene);
  const nextClick = useStore((s) => s.nextClick);
  const load = useStore((s) => s.load);

  useEffect(() => {
    load(GRAPH_URLS);
  }, [load]);

  const hint =
    mode === "p2p" || mode === "race"
      ? HINTS[nextClick]
      : HINTS[mode];

  return (
    <div className="app-root" data-theme={theme}>
      <div className="map-layer">
        <MapCanvas />
      </div>

      {status === "ready" && (
        <>
          <TopBar />
          <Hud />
          <RaceChart />
          <Scrubber />
          <TokensDrawer />

          {mode === "race" && scene && (
            <>
              <PaneBadge side="left" label={scene.panes[0]?.label ?? "DIJKSTRA"} colorRole="a" />
              <PaneBadge side="right" label={scene.panes[1]?.label ?? "A★"} colorRole="b" />
            </>
          )}

          <div className="hint glass">{hint}</div>
        </>
      )}

      {status === "loading" && (
        <div className="overlay-center">
          <div className="spin" />
          <span>loading Munich graph…</span>
        </div>
      )}
      {status === "error" && (
        <div className="overlay-center">
          <span style={{ color: "var(--danger)" }}>failed to load graph</span>
          <span style={{ fontSize: "var(--fs-micro)" }}>{error}</span>
        </div>
      )}
    </div>
  );
}

function PaneBadge({ side, label, colorRole }: { side: "left" | "right"; label: string; colorRole: "a" | "b" }) {
  const style = side === "left" ? { left: 16 } : { right: 16 };
  return (
    <div className="pane-badge glass" style={style}>
      <span className="dotsq" style={{ background: colorRole === "a" ? "var(--algo-a)" : "var(--algo-b)" }} />
      <span>{label}</span>
    </div>
  );
}
