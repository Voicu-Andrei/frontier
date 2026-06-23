import type { Graph } from "../engine/types";
import type { Palette } from "../theme/themes";
import type { Scene, MarkerSpec } from "../state/scene";
import { Viewport } from "./projection";

// per-class [casing px, road px, isMajor]
const ROAD_STYLE: Record<number, [number, number, boolean]> = {
  0: [4.4, 3.0, true],
  1: [3.6, 2.4, true],
  2: [3.0, 2.0, true],
  3: [2.4, 1.5, false],
  4: [2.0, 1.2, false],
  5: [1.5, 0.8, false],
  6: [1.3, 0.7, false],
};

const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t));

function poly(ctx: CanvasRenderingContext2D, vp: Viewport, pts: Float64Array): void {
  ctx.beginPath();
  ctx.moveTo(vp.toScreenX(pts[0]), vp.toScreenY(pts[1]));
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(vp.toScreenX(pts[i]), vp.toScreenY(pts[i + 1]));
}

function fillRing(ctx: CanvasRenderingContext2D, vp: Viewport, ring: Float64Array, color: string): void {
  if (ring.length < 6) return;
  poly(ctx, vp, ring);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draw the static basemap (land, water, parks, rivers, roads). Cache this. */
export function renderBase(ctx: CanvasRenderingContext2D, g: Graph, palette: Palette, vp: Viewport): void {
  ctx.fillStyle = palette.mapLand;
  ctx.fillRect(0, 0, vp.width, vp.height);

  for (const w of g.features.water) fillRing(ctx, vp, w, palette.mapWater);
  for (const pk of g.features.parks) fillRing(ctx, vp, pk, palette.mapPark);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const r of g.features.rivers) {
    poly(ctx, vp, r.pts);
    ctx.strokeStyle = palette.mapWater;
    ctx.lineWidth = Math.max(2, r.width_m * vp.scale);
    ctx.stroke();
  }

  const widthScale = 0.7 + 0.55 * Math.sqrt(vp.zoom);
  drawRoadPass(ctx, g, vp, widthScale, true, palette);
  drawRoadPass(ctx, g, vp, widthScale, false, palette);
}

function drawRoadPass(ctx: CanvasRenderingContext2D, g: Graph, vp: Viewport, ws: number, casing: boolean, palette: Palette): void {
  const { head, to, klass, geom, mx, my } = g;
  for (let u = 0; u < g.nodeCount; u++) {
    for (let e = head[u]; e < head[u + 1]; e++) {
      const v = to[e];
      if (v < u) continue; // dedup undirected pairs
      const st = ROAD_STYLE[klass[e]] ?? ROAD_STYLE[5];
      ctx.lineWidth = (casing ? st[0] : st[1]) * ws;
      ctx.strokeStyle = casing ? palette.roadCasing : st[2] ? palette.road : palette.roadMinor;
      const gm = geom[e];
      ctx.beginPath();
      if (gm) {
        ctx.moveTo(vp.toScreenX(gm[0]), vp.toScreenY(gm[1]));
        for (let i = 2; i < gm.length; i += 2) ctx.lineTo(vp.toScreenX(gm[i]), vp.toScreenY(gm[i + 1]));
      } else {
        ctx.moveTo(vp.toScreenX(mx[u]), vp.toScreenY(my[u]));
        ctx.lineTo(vp.toScreenX(mx[v]), vp.toScreenY(my[v]));
      }
      ctx.stroke();
    }
  }
}

/** Draw the animated overlay for one pane at a given progress (0..1). */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  g: Graph,
  palette: Palette,
  vp: Viewport,
  scene: Scene,
  paneIndex: number,
  progress: number,
  timeMs: number,
): void {
  const paneObj = scene.panes[paneIndex];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (scene.iso) {
    drawIso(ctx, g, palette, vp, scene.iso, progress);
  } else if (paneObj) {
    drawFrontier(ctx, palette, vp, paneObj.frontier, paneObj.frontierCount, progress, "warm");
    if (paneObj.frontierB) {
      drawFrontier(ctx, palette, vp, paneObj.frontierB, paneObj.frontierBCount ?? 0, progress, "cool");
    }
  }

  if (paneObj) {
    const reveal = easeOut(progress);
    for (const route of paneObj.routes) drawRoute(ctx, palette, vp, route, reveal);
  }

  renderMarkers(ctx, palette, vp, scene.markers, timeMs);
}

function drawFrontier(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  vp: Viewport,
  segs: Float64Array,
  count: number,
  progress: number,
  variant: "warm" | "cool",
): void {
  const k = Math.floor(progress * count);
  if (k <= 0) return;
  const hot = Math.max(2, count * 0.03);
  const warm = Math.max(8, count * 0.12);
  const hotC = variant === "warm" ? palette.frontierWave2 : palette.routeB;
  const warmC = variant === "warm" ? palette.frontierWave1 : palette.algoB;
  const settleC = palette.frontierSettle;
  for (let i = 0; i < k; i++) {
    const d = k - i;
    let color: string;
    let lw: number;
    if (d < hot) {
      color = hotC;
      lw = 2.2;
    } else if (d < warm) {
      color = warmC;
      lw = 1.5;
    } else {
      color = settleC;
      lw = 1.0;
    }
    const o = i * 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(vp.toScreenX(segs[o]), vp.toScreenY(segs[o + 1]));
    ctx.lineTo(vp.toScreenX(segs[o + 2]), vp.toScreenY(segs[o + 3]));
    ctx.stroke();
  }
}

function drawIso(ctx: CanvasRenderingContext2D, g: Graph, palette: Palette, vp: Viewport, iso: Scene["iso"] & object, progress: number): void {
  const thr = progress * iso.budget; // scrubbing floods by real arrival time
  const { dist } = iso.result;
  const { head, to, geom, mx, my } = g;

  // Concave reachable area — a faint fill + boundary that hugs the road network
  // (carves out water / fields instead of ballooning across them).
  if (iso.hullRings.length) {
    ctx.beginPath();
    for (const ring of iso.hullRings) {
      ctx.moveTo(vp.toScreenX(ring[0]), vp.toScreenY(ring[1]));
      for (let i = 2; i < ring.length; i += 2) ctx.lineTo(vp.toScreenX(ring[i]), vp.toScreenY(ring[i + 1]));
      ctx.closePath();
    }
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = palette.frontierWave1;
    ctx.fill("evenodd");
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = palette.frontierWave1;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Reachable streets coloured by arrival-time band. This is the honest
  // isochrone: motorways stay lit far out, slow streets drop off sooner — proof
  // the search respects road speeds. Draw slowest band first so faster sits on top.
  const bandColor = [palette.frontierWave2, palette.frontierWave1, palette.algoB];
  const bandWidth = [1.9, 1.5, 1.1];
  const bandOf = (t: number) => (t <= iso.bands[0] ? 0 : t <= iso.bands[1] ? 1 : 2);
  for (let band = 2; band >= 0; band--) {
    ctx.strokeStyle = bandColor[band];
    ctx.lineWidth = bandWidth[band];
    for (let u = 0; u < g.nodeCount; u++) {
      if (dist[u] > thr) continue;
      for (let e = head[u]; e < head[u + 1]; e++) {
        const v = to[e];
        if (v < u || dist[v] > thr) continue;
        const t = Math.max(dist[u], dist[v]);
        if (bandOf(t) !== band) continue;
        const gm = geom[e];
        ctx.beginPath();
        if (gm) {
          ctx.moveTo(vp.toScreenX(gm[0]), vp.toScreenY(gm[1]));
          for (let i = 2; i < gm.length; i += 2) ctx.lineTo(vp.toScreenX(gm[i]), vp.toScreenY(gm[i + 1]));
        } else {
          ctx.moveTo(vp.toScreenX(mx[u]), vp.toScreenY(my[u]));
          ctx.lineTo(vp.toScreenX(mx[v]), vp.toScreenY(my[v]));
        }
        ctx.stroke();
      }
    }
  }
}

function drawRoute(ctx: CanvasRenderingContext2D, palette: Palette, vp: Viewport, route: Float64Array, reveal: number): void {
  if (route.length < 4) return;
  const total = route.length / 2 - 1;
  const last = Math.max(1, Math.floor(total * reveal));
  const grad = ctx.createLinearGradient(
    vp.toScreenX(route[0]),
    vp.toScreenY(route[1]),
    vp.toScreenX(route[route.length - 2]),
    vp.toScreenY(route[route.length - 1]),
  );
  grad.addColorStop(0, palette.routeA);
  grad.addColorStop(1, palette.routeB);

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(vp.toScreenX(route[0]), vp.toScreenY(route[1]));
    for (let i = 1; i <= last; i++) ctx.lineTo(vp.toScreenX(route[2 * i]), vp.toScreenY(route[2 * i + 1]));
  };
  // casing
  trace();
  ctx.strokeStyle = palette.routeCasing;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  // gradient core with glow
  trace();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3.4;
  ctx.shadowColor = palette.routeB;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function renderMarkers(ctx: CanvasRenderingContext2D, palette: Palette, vp: Viewport, markers: MarkerSpec[], timeMs: number): void {
  for (const m of markers) {
    const x = vp.toScreenX(m.x);
    const y = vp.toScreenY(m.y);
    switch (m.role) {
      case "start": {
        const t = (timeMs % 2600) / 2600;
        const rr = 9 + t * 16;
        ctx.globalAlpha = Math.max(0, 0.6 - t * 0.6);
        ctx.strokeStyle = palette.start;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        dot(ctx, x, y, 6.5, palette.start);
        break;
      }
      case "end":
        ring(ctx, x, y, 11, palette.end);
        dot(ctx, x, y, 6.5, palette.end);
        break;
      case "unit": {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = palette.accent;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-6, -6, 12, 12);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "job":
        ring(ctx, x, y, 7, palette.end, 3);
        break;
      case "meet": {
        // where the two bidirectional searches collided
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = palette.frontierWave2;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-6, -6, 12, 12);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "stop":
        dot(ctx, x, y, 10, palette.accent, "#fff");
        if (m.label) {
          ctx.fillStyle = palette.accentInk;
          ctx.font = "600 11px 'IBM Plex Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(m.label, x, y + 0.5);
        }
        break;
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw = 2): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}
