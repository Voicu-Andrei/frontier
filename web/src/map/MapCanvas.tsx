import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { Viewport } from "./projection";
import { renderBase, renderOverlay } from "./render";
import { readPalette, type Palette } from "../theme/themes";
import { SWEEP_SECONDS } from "../config";

interface Panel {
  x: number;
  width: number;
  vp: Viewport;
  base: HTMLCanvasElement;
  baseDirty: boolean;
  paneIndex: number;
}

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const graph = useStore((s) => s.graph);
  const scene = useStore((s) => s.scene);
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);

  const panelsRef = useRef<Panel[]>([]);
  const paletteRef = useRef<Palette | null>(null);
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // resolve the theme palette (also used to re-tint the cached basemap)
  useEffect(() => {
    rootRef.current = document.querySelector("[data-theme]");
    if (rootRef.current) paletteRef.current = readPalette(rootRef.current);
    for (const p of panelsRef.current) p.baseDirty = true;
  }, [theme]);

  // (re)build panels on graph / mode / layout change
  useEffect(() => {
    if (!graph) return;
    const build = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const count = mode === "race" ? 2 : 1;
      const panels: Panel[] = [];
      for (let i = 0; i < count; i++) {
        const pw = w / count;
        const vp = new Viewport();
        vp.fit(graph, pw, h);
        const base = document.createElement("canvas");
        base.width = pw * dpr;
        base.height = h * dpr;
        panels.push({ x: i * pw, width: pw, vp, base, baseDirty: true, paneIndex: i });
      }
      panelsRef.current = panels;
      if (rootRef.current) paletteRef.current = readPalette(rootRef.current);
    };
    build();
    const ro = new ResizeObserver(build);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [graph, mode]);

  // single animation loop drives progress + draws every frame
  useEffect(() => {
    if (!graph) return;
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = now - last;
      last = now;
      const st = useStore.getState();
      if (st.playing && st.scene) {
        let p = st.progress + dt / (SWEEP_SECONDS * 1000);
        if (p >= 1) p = 0;
        st.setProgress(p);
      }
      paint(now);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  function paint(now: number) {
    const canvas = canvasRef.current;
    const g = useStore.getState().graph;
    const sc = sceneRef.current;
    const palette = paletteRef.current;
    if (!canvas || !g || !palette) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { dpr, h } = sizeRef.current;
    const progress = useStore.getState().progress;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const panel of panelsRef.current) {
      if (panel.baseDirty) {
        const bctx = panel.base.getContext("2d")!;
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderBase(bctx, g, palette, panel.vp);
        panel.baseDirty = false;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x, 0, panel.width, h);
      ctx.clip();
      ctx.translate(panel.x, 0);
      ctx.drawImage(panel.base, 0, 0, panel.width, h);
      if (sc) renderOverlay(ctx, g, palette, panel.vp, sc, panel.paneIndex, progress, now);
      ctx.restore();
    }

    // race divider
    if (panelsRef.current.length === 2) {
      const x = sizeRef.current.w / 2;
      ctx.strokeStyle = palette.hairline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  // ---- interaction: click-to-set, drag-pan, wheel-zoom ----
  const drag = useRef({ down: false, moved: false, x: 0, y: 0 });

  function panelAt(px: number): Panel {
    const panels = panelsRef.current;
    return panels.find((p) => px >= p.x && px < p.x + p.width) ?? panels[0];
  }

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { down: true, moved: false, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.down) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
    if (drag.current.moved) {
      for (const p of panelsRef.current) {
        p.vp.panBy(dx, dy);
        p.baseDirty = true;
      }
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = drag.current.moved;
    drag.current.down = false;
    if (wasDrag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const panel = panelAt(px);
    const wx = panel.vp.toWorldX(px - panel.x);
    const wy = panel.vp.toWorldY(py);
    useStore.getState().mapClick(wx, wy);
  };
  const onWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    for (const p of panelsRef.current) {
      p.vp.zoomAt(px - p.x, py, factor);
      p.baseDirty = true;
    }
  };

  return (
    <div ref={wrapRef} className="map-wrap">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}
