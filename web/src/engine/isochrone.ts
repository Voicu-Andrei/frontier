import type { Graph, SearchResult, Weight } from "./types";
import { dijkstra } from "./dijkstra";

export interface Isochrone {
  result: SearchResult;
  /** Number of nodes reachable within the budget. */
  reachable: number;
  /** Spiky reach polygon (world metres, flat [x,y,...]) derived from real reach. */
  hull: Float64Array;
  /** Mean reach radius (m) — the dashed "naive circle" a radius would guess. */
  estRadius: number;
  /** Polygon area in km². */
  areaKm2: number;
  budgetSeconds: number;
}

const BINS = 128;

/**
 * Isochrone = bounded Dijkstra with no target: settle everything within a time
 * budget, then wrap it. The hull is built from the ACTUAL farthest reachable
 * node in each angular sector, so it bulges along fast arterials and pulls in
 * where the network is slow — the spikes are real, not decoration. A dashed
 * mean-radius circle is returned alongside to contrast with a naive radius.
 */
export function isochrone(
  g: Graph,
  source: number,
  budgetSeconds: number,
  weight: Weight = "time",
): Isochrone {
  const result = dijkstra(g, source, { weight, maxCost: budgetSeconds });
  const { dist } = result;
  const sx = g.mx[source];
  const sy = g.my[source];

  const binMaxR = new Float64Array(BINS).fill(-1);
  const binX = new Float64Array(BINS);
  const binY = new Float64Array(BINS);
  let reachable = 0;
  let radiusSum = 0;

  for (let i = 0; i < g.nodeCount; i++) {
    if (dist[i] === Infinity) continue;
    reachable++;
    const dx = g.mx[i] - sx;
    const dy = g.my[i] - sy;
    const r = Math.sqrt(dx * dx + dy * dy);
    radiusSum += r;
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI * 2;
    const b = Math.min(BINS - 1, Math.floor((ang / (Math.PI * 2)) * BINS));
    if (r > binMaxR[b]) {
      binMaxR[b] = r;
      binX[b] = g.mx[i];
      binY[b] = g.my[i];
    }
  }

  // Fill empty sectors by interpolating from the nearest filled neighbours.
  for (let b = 0; b < BINS; b++) {
    if (binMaxR[b] >= 0) continue;
    let lo = b,
      hi = b;
    while (binMaxR[(lo + BINS) % BINS] < 0) lo--;
    while (binMaxR[hi % BINS] < 0) hi++;
    const rr = (binMaxR[(lo + BINS) % BINS] + binMaxR[hi % BINS]) / 2;
    const ang = ((b + 0.5) / BINS) * Math.PI * 2;
    binMaxR[b] = rr;
    binX[b] = sx + Math.cos(ang) * rr;
    binY[b] = sy + Math.sin(ang) * rr;
  }

  // Light smoothing so the blob reads organic, not jagged-by-bin.
  const hull = new Float64Array(BINS * 2);
  for (let b = 0; b < BINS; b++) {
    const xm = (binX[(b - 1 + BINS) % BINS] + 2 * binX[b] + binX[(b + 1) % BINS]) / 4;
    const ym = (binY[(b - 1 + BINS) % BINS] + 2 * binY[b] + binY[(b + 1) % BINS]) / 4;
    hull[2 * b] = xm;
    hull[2 * b + 1] = ym;
  }

  return {
    result,
    reachable,
    hull,
    estRadius: reachable ? radiusSum / reachable : 0,
    areaKm2: polygonAreaKm2(hull),
    budgetSeconds,
  };
}

function polygonAreaKm2(poly: Float64Array): number {
  let a = 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += poly[2 * i] * poly[2 * j + 1] - poly[2 * j] * poly[2 * i + 1];
  }
  return Math.abs(a / 2) / 1e6;
}
