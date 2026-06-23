import type { Graph, SearchResult, Weight } from "./types";
import { dijkstra } from "./dijkstra";

export interface Isochrone {
  result: SearchResult;
  /** Nodes reachable within the full budget. */
  reachable: number;
  budgetSeconds: number;
  source: number;
}

export interface Contour {
  /** Smoothed concave boundary polygon (world metres, flat [x,y,...]). */
  hull: Float64Array;
  minutes: number;
  thresholdSeconds: number;
  areaKm2: number;
  reachable: number;
}

const BINS = 144;

/**
 * Isochrone = bounded Dijkstra with no target. "How far can someone get from
 * here in N minutes?" — settle everything within the time budget, once. The
 * answer is static; the boundary is derived from the ACTUAL farthest reachable
 * node in each direction, so it bulges along fast roads and pulls in where the
 * network is slow.
 */
export function isochrone(g: Graph, source: number, budgetSeconds: number, weight: Weight = "time"): Isochrone {
  const result = dijkstra(g, source, { weight, maxCost: budgetSeconds });
  let reachable = 0;
  for (let i = 0; i < g.nodeCount; i++) if (result.dist[i] !== Infinity) reachable++;
  return { result, reachable, budgetSeconds, source };
}

/**
 * Concave boundary of everything reachable within `thresholdSeconds`, built from
 * the single Dijkstra run. Several thresholds give nested static time-contours
 * (e.g. 5 / 10 / 15 min) — like a real isochrone map, no fake growth animation.
 */
export function contourHull(g: Graph, source: number, result: SearchResult, thresholdSeconds: number): Contour {
  const { dist } = result;
  const sx = g.mx[source];
  const sy = g.my[source];
  const binMaxR = new Float64Array(BINS).fill(-1);
  const binX = new Float64Array(BINS);
  const binY = new Float64Array(BINS);
  let reachable = 0;

  for (let i = 0; i < g.nodeCount; i++) {
    if (dist[i] > thresholdSeconds) continue;
    reachable++;
    const dx = g.mx[i] - sx;
    const dy = g.my[i] - sy;
    const r = Math.sqrt(dx * dx + dy * dy);
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI * 2;
    const b = Math.min(BINS - 1, Math.floor((ang / (Math.PI * 2)) * BINS));
    if (r > binMaxR[b]) {
      binMaxR[b] = r;
      binX[b] = g.mx[i];
      binY[b] = g.my[i];
    }
  }

  // fill empty sectors by interpolating between the nearest filled neighbours
  for (let b = 0; b < BINS; b++) {
    if (binMaxR[b] >= 0) continue;
    let lo = b;
    let hi = b;
    while (binMaxR[(lo + BINS) % BINS] < 0) lo--;
    while (binMaxR[hi % BINS] < 0) hi++;
    const rr = (binMaxR[(lo + BINS) % BINS] + binMaxR[hi % BINS]) / 2;
    const ang = ((b + 0.5) / BINS) * Math.PI * 2;
    binMaxR[b] = rr;
    binX[b] = sx + Math.cos(ang) * rr;
    binY[b] = sy + Math.sin(ang) * rr;
  }

  // light smoothing so the boundary reads organic, not binned
  const hull = new Float64Array(BINS * 2);
  for (let b = 0; b < BINS; b++) {
    hull[2 * b] = (binX[(b - 1 + BINS) % BINS] + 2 * binX[b] + binX[(b + 1) % BINS]) / 4;
    hull[2 * b + 1] = (binY[(b - 1 + BINS) % BINS] + 2 * binY[b] + binY[(b + 1) % BINS]) / 4;
  }

  return {
    hull,
    minutes: thresholdSeconds / 60,
    thresholdSeconds,
    areaKm2: polygonAreaKm2(hull),
    reachable,
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
