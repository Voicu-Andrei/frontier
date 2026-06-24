import { useRef } from "react";
import { useStore } from "../state/store";
import { SPEED_PRESETS } from "../config";

export function Scrubber() {
  const trackRef = useRef<HTMLDivElement>(null);
  const scene = useStore((s) => s.scene);
  const progress = useStore((s) => s.progress);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const togglePlay = useStore((s) => s.togglePlay);
  const setProgress = useStore((s) => s.setProgress);
  const setPlaying = useStore((s) => s.setPlaying);
  const setSpeed = useStore((s) => s.setSpeed);

  const total = scene?.totalSteps ?? 0;
  const step = Math.round(progress * total);
  const pct = `${(progress * 100).toFixed(2)}%`;

  const seek = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };
  const onDown = (e: React.PointerEvent) => {
    setPlaying(false);
    seek(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) seek(e.clientX);
  };

  return (
    <div className="scrubber glass">
      <button className="play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 12 12">
            <rect x="1.5" y="1" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="7.5" y="1" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 12 12">
            <path d="M2.5 1.4 L10.5 6 L2.5 10.6 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="scrub-label">
        <span className="scrub-algo">{scene?.algoLabel ?? "—"}</span>
        <span className="scrub-sub">FRONTIER EXPANSION</span>
      </div>

      <div className="track" ref={trackRef} onPointerDown={onDown} onPointerMove={onMove}>
        <div className="track-ticks" />
        <div className="track-rail" />
        <div className="track-fill" style={{ width: pct }} />
        <div className="track-thumb" style={{ left: pct }} />
      </div>

      <div className="speed">
        <span className="cap" style={{ fontSize: 9 }}>SPEED</span>
        <div className="speed-pills">
          {SPEED_PRESETS.map((p) => (
            <button
              key={p.steps}
              className={`speed-pill${speed === p.steps ? " active" : ""}`}
              onClick={() => setSpeed(p.steps)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrub-steps">
        <span className="scrub-step">{String(step).padStart(3, "0")}</span>
        <span className="scrub-steptotal">/ {total} STEPS</span>
      </div>
    </div>
  );
}
