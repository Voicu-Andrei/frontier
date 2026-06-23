import { useStore } from "../state/store";

export function Hud() {
  const scene = useStore((s) => s.scene);
  if (!scene) return null;
  return (
    <div className="hud glass">
      <div className="hud-head">
        <span className="cap">READOUT</span>
        <span className="algo-tag">{scene.algoLabel}</span>
      </div>
      {scene.hud.map((row) => (
        <div className="hud-row" key={row.label}>
          <span className="hud-label">{row.label}</span>
          <span className="hud-val">
            <span className="metric">{row.value}</span>
            {row.unit && <span className="unit">{row.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
