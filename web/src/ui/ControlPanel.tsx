import { useStore } from "../state/store";

const ISO_PRESETS = [3, 5, 10, 15, 20];

/** Mode-specific controls (top-left). Only rendered for modes that have any. */
export function ControlPanel() {
  const mode = useStore((s) => s.mode);
  const params = useStore((s) => s.params);
  const placing = useStore((s) => s.placing);
  const setIsoBudget = useStore((s) => s.setIsoBudget);
  const setPlacing = useStore((s) => s.setPlacing);
  const multiUndo = useStore((s) => s.multiUndo);
  const multiClear = useStore((s) => s.multiClear);
  const dispatchClear = useStore((s) => s.dispatchClear);

  if (mode === "iso") {
    const m = params.isoBudgetMin;
    return (
      <div className="controls glass">
        <span className="cap">REACH WITHIN</span>
        <div className="ctl-row ctl-spread">
          <button className="ctl-btn ctl-step" onClick={() => setIsoBudget(Math.max(1, m - 1))}>
            −
          </button>
          <span className="ctl-bignum">
            {m}
            <span style={{ fontSize: "var(--fs-cap)", color: "var(--ink-faint)" }}> min</span>
          </span>
          <button className="ctl-btn ctl-step" onClick={() => setIsoBudget(Math.min(40, m + 1))}>
            +
          </button>
        </div>
        <div className="ctl-presets">
          {ISO_PRESETS.map((p) => (
            <button key={p} className={`ctl-preset${m === p ? " active" : ""}`} onClick={() => setIsoBudget(p)}>
              {p}
            </button>
          ))}
        </div>
        <span style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint)", lineHeight: 1.4 }}>
          Click the map to move the origin.
        </span>
      </div>
    );
  }

  if (mode === "multi") {
    return (
      <div className="controls glass">
        <div className="ctl-row ctl-spread">
          <span className="cap">STOPS</span>
          <span className="ctl-bignum" style={{ minWidth: 0, fontSize: "var(--fs-md)" }}>
            {params.stops.length}
          </span>
        </div>
        <div className="ctl-row">
          <button className="ctl-btn" style={{ flex: 1 }} onClick={multiUndo} disabled={params.stops.length === 0}>
            Undo
          </button>
          <button className="ctl-btn" style={{ flex: 1 }} onClick={multiClear}>
            Clear
          </button>
        </div>
        <span style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint)", lineHeight: 1.4 }}>
          Click the map to add a stop (max 9). First stop is the start.
        </span>
      </div>
    );
  }

  if (mode === "dispatch") {
    return (
      <div className="controls glass">
        <span className="cap">PLACE ON CLICK</span>
        <div className="ctl-row">
          <button className={`ctl-btn${placing === "unit" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setPlacing("unit")}>
            ◆ Units
          </button>
          <button className={`ctl-btn${placing === "call" ? " active" : ""}`} style={{ flex: 1 }} onClick={() => setPlacing("call")}>
            ◯ Calls
          </button>
        </div>
        <div className="ctl-row ctl-spread">
          <span style={{ fontSize: "var(--fs-cap)", color: "var(--ink-muted)" }}>
            {params.units.length} units · {params.jobs.length} calls
          </span>
        </div>
        <div className="ctl-row">
          <button className="ctl-btn" style={{ flex: 1 }} onClick={() => dispatchClear("units")}>
            Clear units
          </button>
          <button className="ctl-btn" style={{ flex: 1 }} onClick={() => dispatchClear("calls")}>
            Clear calls
          </button>
        </div>
      </div>
    );
  }

  return null;
}
