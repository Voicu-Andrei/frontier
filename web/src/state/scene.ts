import type { Graph, SearchResult, Weight } from "../engine/types";
import { dijkstra } from "../engine/dijkstra";
import { astar } from "../engine/astar";
import { reconstructPath, pathPolyline, pathStats } from "../engine/path";
import { isochrone } from "../engine/isochrone";
import { bidirectional, reconstructBidir } from "../engine/bidirectional";
import { multiSourceDijkstra, reconstructToSource } from "../engine/multisource";
import { multiStopRoute } from "../engine/multistop";
import { yenKShortest } from "../engine/yen";

export type Mode = "p2p" | "bidir" | "race" | "iso" | "multi" | "dispatch" | "alt";

export interface MarkerSpec {
  x: number;
  y: number;
  role: "start" | "end" | "unit" | "job" | "stop" | "meet";
  label?: string;
  /** Hide the marker until the animation reaches this progress (0..1). */
  revealAt?: number;
}

/** A polyline the renderer draws on; `revealAt` is when it starts appearing. */
export interface RouteLine {
  poly: Float64Array;
  revealAt: number;
  /** 0 = primary route (gradient); >0 = alternative (distinct solid colour). */
  rank: number;
}

export interface Pane {
  label: string;
  colorRole: "a" | "b";
  /** Explored edges in settle order, flat [ax,ay,bx,by,...] (world metres). */
  frontier: Float64Array;
  frontierCount: number;
  /** Optional second frontier (backward search in bidirectional mode). */
  frontierB?: Float64Array;
  frontierBCount?: number;
  /** Polylines to reveal with progress (route legs, dispatch assignments). */
  routes: RouteLine[];
}

export interface IsoLayer {
  hullRings: Float64Array[]; // concave boundary of the reachable area
  bands: number[]; // time-band thresholds (seconds, ascending)
  sx: number;
  sy: number;
  result: SearchResult;
  budget: number;
}

export interface HudRow {
  label: string;
  value: string;
  unit: string;
}

export interface RaceStats {
  aNodes: number;
  aMs: number;
  bNodes: number;
  bMs: number;
  speedup: number;
}

export interface Scene {
  mode: Mode;
  panes: Pane[];
  markers: MarkerSpec[];
  iso?: IsoLayer;
  totalSteps: number;
  hud: HudRow[];
  algoLabel: string;
  race?: RaceStats;
  /** Set when the query is incomplete (e.g. too few stops) — shown to the user. */
  notice?: string;
}

export interface SceneParams {
  mode: Mode;
  weight: Weight;
  source: number;
  target: number;
  isoBudgetMin: number;
  stops: number[];
  units: number[];
  jobs: number[];
}

const km = (m: number) => (m / 1000).toFixed(1);
const min = (s: number) => Math.round(s / 60);
const kmh = (m: number, s: number) => (s > 0 ? Math.round((m * 3.6) / s) : 0);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function frontierFrom(g: Graph, order: Int32Array, prev: Int32Array, count: number): { buf: Float64Array; count: number } {
  const tmp = new Float64Array(count * 4);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const v = order[i];
    const u = prev[v];
    if (u < 0) continue;
    tmp[n++] = g.mx[u];
    tmp[n++] = g.my[u];
    tmp[n++] = g.mx[v];
    tmp[n++] = g.my[v];
  }
  return { buf: tmp.subarray(0, n), count: n / 4 };
}

const frontierSegs = (g: Graph, r: SearchResult) => frontierFrom(g, r.order, r.prev, r.settledCount);

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

const marker = (g: Graph, node: number, role: MarkerSpec["role"], label?: string, revealAt?: number): MarkerSpec => ({
  x: g.mx[node],
  y: g.my[node],
  role,
  label,
  revealAt,
});

/** Wrap plain polylines as primary RouteLines that draw from the start. */
const lines = (polys: Float64Array[]): RouteLine[] => polys.map((poly) => ({ poly, revealAt: 0, rank: 0 }));

/** Settle rank of a node (0..1) within a search trace, for reveal timing. */
function settleProgress(order: Int32Array, count: number, node: number): number {
  for (let i = 0; i < count; i++) if (order[i] === node) return i / Math.max(1, count);
  return 1;
}

function pane(g: Graph, r: SearchResult, label: string, colorRole: "a" | "b", routes: Float64Array[]): Pane {
  const f = frontierSegs(g, r);
  return { label, colorRole, frontier: f.buf, frontierCount: f.count, routes: lines(routes) };
}

export function buildScene(g: Graph, p: SceneParams): Scene {
  switch (p.mode) {
    case "bidir":
      return buildBidir(g, p);
    case "race":
      return buildRace(g, p);
    case "iso":
      return buildIso(g, p);
    case "multi":
      return buildMulti(g, p);
    case "dispatch":
      return buildDispatch(g, p);
    case "alt":
      return buildAlt(g, p);
    default:
      return buildP2P(g, p);
  }
}

function buildP2P(g: Graph, p: SceneParams): Scene {
  const { value: r, ms } = timed(() => astar(g, p.source, p.target, { weight: p.weight }));
  const path = reconstructPath(r, p.source, p.target);
  const route = path ? pathPolyline(g, path) : new Float64Array(0);
  const stats = path ? pathStats(g, path) : null;
  return {
    mode: "p2p",
    panes: [pane(g, r, "A★", "a", route.length ? [route] : [])],
    markers: [marker(g, p.source, "start"), marker(g, p.target, "end")],
    totalSteps: r.settledCount,
    algoLabel: "A★ · ROUTE",
    hud: [
      { label: "DISTANCE", value: stats ? km(stats.distance_m) : "—", unit: "km" },
      { label: "ETA", value: stats ? String(min(stats.time_s)) : "—", unit: "min" },
      { label: "AVG SPEED", value: stats ? String(kmh(stats.distance_m, stats.time_s)) : "—", unit: "km/h" },
      { label: "TURNS", value: stats ? String(stats.turns) : "—", unit: "" },
      { label: "PATH NODES", value: path ? String(path.nodes.length) : "—", unit: "" },
      { label: "NODES EXPLORED", value: fmt(r.settledCount), unit: "" },
      { label: "% OF NETWORK", value: ((r.settledCount / g.nodeCount) * 100).toFixed(0), unit: "%" },
      { label: "RUNTIME", value: ms.toFixed(2), unit: "ms" },
    ],
  };
}

function buildBidir(g: Graph, p: SceneParams): Scene {
  const { value: r, ms } = timed(() => bidirectional(g, p.source, p.target, { weight: p.weight }));
  const path = reconstructBidir(r);
  const route = path ? pathPolyline(g, path) : new Float64Array(0);
  const stats = path ? pathStats(g, path) : null;
  // baseline: one-directional Dijkstra on the same query, for the savings story
  const dij = dijkstra(g, p.source, { weight: p.weight, target: p.target });
  const totalNodes = r.settledF + r.settledB;

  const fwd = frontierFrom(g, r.orderF, r.prevF, r.settledF);
  const bwd = frontierFrom(g, r.orderB, r.prevB, r.settledB);
  // The meeting point is DISCOVERED during the search, not known up front — so
  // reveal it (and the stitched route) only once both frontiers have grown to it.
  const meetProgress =
    r.meet >= 0
      ? Math.max(settleProgress(r.orderF, r.settledF, r.meet), settleProgress(r.orderB, r.settledB, r.meet))
      : 1;
  const thePane: Pane = {
    label: "BIDIRECTIONAL",
    colorRole: "a",
    frontier: fwd.buf,
    frontierCount: fwd.count,
    frontierB: bwd.buf,
    frontierBCount: bwd.count,
    routes: route.length ? [{ poly: route, revealAt: meetProgress, rank: 0 }] : [],
  };
  const markers: MarkerSpec[] = [marker(g, p.source, "start"), marker(g, p.target, "end")];
  if (r.meet >= 0) markers.push(marker(g, r.meet, "meet", undefined, meetProgress));

  const savings = dij.settledCount > 0 ? (1 - totalNodes / dij.settledCount) * 100 : 0;
  return {
    mode: "bidir",
    panes: [thePane],
    markers,
    totalSteps: totalNodes,
    algoLabel: "BIDIRECTIONAL DIJKSTRA",
    hud: [
      { label: "DISTANCE", value: stats ? km(stats.distance_m) : "—", unit: "km" },
      { label: "ETA", value: stats ? String(min(stats.time_s)) : "—", unit: "min" },
      { label: "TURNS", value: stats ? String(stats.turns) : "—", unit: "" },
      { label: "NODES (TOTAL)", value: fmt(totalNodes), unit: "" },
      { label: "FWD / BWD", value: `${fmt(r.settledF)}/${fmt(r.settledB)}`, unit: "" },
      { label: "1-DIR DIJKSTRA", value: fmt(dij.settledCount), unit: "" },
      { label: "FEWER NODES", value: savings.toFixed(0), unit: "%" },
      { label: "RUNTIME", value: ms.toFixed(2), unit: "ms" },
    ],
  };
}

function buildRace(g: Graph, p: SceneParams): Scene {
  const d = timed(() => dijkstra(g, p.source, { weight: p.weight, target: p.target }));
  const a = timed(() => astar(g, p.source, p.target, { weight: p.weight }));
  const dPath = reconstructPath(d.value, p.source, p.target);
  const aPath = reconstructPath(a.value, p.source, p.target);
  const speedup = a.value.settledCount > 0 ? d.value.settledCount / a.value.settledCount : 1;
  const stats = aPath ? pathStats(g, aPath) : null;
  return {
    mode: "race",
    panes: [
      pane(g, d.value, "DIJKSTRA", "a", dPath ? [pathPolyline(g, dPath)] : []),
      pane(g, a.value, "A★", "b", aPath ? [pathPolyline(g, aPath)] : []),
    ],
    markers: [marker(g, p.source, "start"), marker(g, p.target, "end")],
    totalSteps: Math.max(d.value.settledCount, a.value.settledCount),
    algoLabel: "DIJKSTRA × A★",
    race: { aNodes: d.value.settledCount, aMs: d.ms, bNodes: a.value.settledCount, bMs: a.ms, speedup },
    hud: [
      { label: "LEADER", value: a.value.settledCount < d.value.settledCount ? "A★" : "DIJK", unit: "" },
      { label: "FEWER NODES", value: speedup.toFixed(1), unit: "×" },
      { label: "DIJKSTRA NODES", value: fmt(d.value.settledCount), unit: "" },
      { label: "A★ NODES", value: fmt(a.value.settledCount), unit: "" },
      { label: "Δ NODES", value: fmt(Math.max(0, d.value.settledCount - a.value.settledCount)), unit: "" },
      { label: "DISTANCE", value: stats ? km(stats.distance_m) : "—", unit: "km" },
      { label: "RUNTIME D/A", value: `${d.ms.toFixed(1)}/${a.ms.toFixed(1)}`, unit: "ms" },
    ],
  };
}

function buildIso(g: Graph, p: SceneParams): Scene {
  const budget = p.isoBudgetMin * 60;
  const iso = isochrone(g, p.source, budget, "time");
  // farthest straight-line reach (along the fastest corridor)
  let farthest = 0;
  for (let i = 0; i < g.nodeCount; i++) {
    if (iso.result.dist[i] === Infinity) continue;
    farthest = Math.max(farthest, Math.hypot(g.mx[i] - g.mx[p.source], g.my[i] - g.my[p.source]));
  }
  return {
    mode: "iso",
    panes: [pane(g, iso.result, "DIJKSTRA", "a", [])],
    markers: [marker(g, p.source, "start")],
    iso: { hullRings: iso.hull.rings, bands: iso.bands, sx: g.mx[p.source], sy: g.my[p.source], result: iso.result, budget },
    totalSteps: iso.result.settledCount,
    algoLabel: `REACH · ${p.isoBudgetMin} MIN`,
    hud: [
      { label: "TIME BUDGET", value: String(p.isoBudgetMin), unit: "min" },
      { label: "REACHABLE AREA", value: iso.hull.areaKm2.toFixed(1), unit: "km²" },
      { label: "NODES REACHED", value: fmt(iso.reachable), unit: "" },
      { label: "% OF NETWORK", value: ((iso.reachable / g.nodeCount) * 100).toFixed(0), unit: "%" },
      { label: "FARTHEST", value: (farthest / 1000).toFixed(1), unit: "km" },
      { label: "AVG REACH SPD", value: String(Math.round((farthest / 1000 / p.isoBudgetMin) * 60)), unit: "km/h" },
    ],
  };
}

function buildMulti(g: Graph, p: SceneParams): Scene {
  if (p.stops.length < 2) {
    return {
      mode: "multi",
      panes: [{ label: "TSP", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes: [] }],
      markers: p.stops.map((n, i) => marker(g, n, i === 0 ? "start" : "stop", i === 0 ? "S" : String(i))),
      totalSteps: 2,
      algoLabel: "TSP · ADD STOPS",
      hud: [{ label: "STOPS", value: String(p.stops.length), unit: "" }],
      notice: "Click the map to add stops (need at least 2)",
    };
  }
  const ms = multiStopRoute(g, p.stops, p.weight);
  const markers: MarkerSpec[] = ms.order.map((node, i) => marker(g, node, i === 0 ? "start" : "stop", i === 0 ? "S" : String(i)));
  const legAvg = ms.legs.length ? ms.distance_m / ms.legs.length : 0;
  return {
    mode: "multi",
    panes: [{ label: "A★", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes: lines([ms.polyline]) }],
    markers,
    totalSteps: Math.max(2, ms.polyline.length / 2),
    algoLabel: "TSP · NEAREST-NEIGHBOUR",
    hud: [
      { label: "STOPS", value: String(p.stops.length), unit: "" },
      { label: "LEGS", value: String(ms.legs.length), unit: "" },
      { label: "TOTAL DIST", value: km(ms.distance_m), unit: "km" },
      { label: "ETA", value: String(min(ms.time_s)), unit: "min" },
      { label: "AVG LEG", value: km(legAvg), unit: "km" },
      { label: "ORDER", value: "OPT*", unit: "" },
    ],
  };
}

function buildDispatch(g: Graph, p: SceneParams): Scene {
  if (p.units.length < 1 || p.jobs.length < 1) {
    return {
      mode: "dispatch",
      panes: [{ label: "DISPATCH", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes: [] }],
      markers: [...p.units.map((u) => marker(g, u, "unit")), ...p.jobs.map((j) => marker(g, j, "job"))],
      totalSteps: 2,
      algoLabel: "DISPATCH · ADD UNITS & CALLS",
      hud: [
        { label: "UNITS", value: String(p.units.length), unit: "" },
        { label: "CALLS", value: String(p.jobs.length), unit: "" },
      ],
      notice: "Add at least one unit and one call",
    };
  }
  const r = multiSourceDijkstra(g, p.units, { weight: p.weight });
  const routes: RouteLine[] = [];
  let assigned = 0;
  let etaSum = 0;
  let etaMax = 0;
  const load = new Array(p.units.length).fill(0);
  for (const job of p.jobs) {
    const chain = reconstructToSource(r, job);
    if (!chain) continue;
    assigned++;
    etaSum += r.dist[job];
    etaMax = Math.max(etaMax, r.dist[job]);
    if (r.origin[job] >= 0) load[r.origin[job]]++;
    const poly: number[] = [];
    for (const node of chain.nodes) poly.push(g.mx[node], g.my[node]);
    // a call is only "claimed" once the flood reaches it — reveal its line then
    routes.push({ poly: Float64Array.from(poly), revealAt: settleProgress(r.order, r.settledCount, job), rank: 0 });
  }
  const f = frontierSegs(g, r);
  return {
    mode: "dispatch",
    panes: [{ label: "MULTI-SOURCE", colorRole: "a", frontier: f.buf, frontierCount: f.count, routes }],
    markers: [...p.units.map((u) => marker(g, u, "unit")), ...p.jobs.map((j) => marker(g, j, "job"))],
    totalSteps: r.settledCount,
    algoLabel: "MULTI-SOURCE · DISPATCH",
    hud: [
      { label: "UNITS", value: String(p.units.length), unit: "" },
      { label: "CALLS", value: String(p.jobs.length), unit: "" },
      { label: "ASSIGNED", value: String(assigned), unit: "" },
      { label: "AVG ETA", value: assigned ? String(min(etaSum / assigned)) : "—", unit: "min" },
      { label: "MAX ETA", value: assigned ? String(min(etaMax)) : "—", unit: "min" },
      { label: "BUSIEST UNIT", value: String(Math.max(0, ...load)), unit: "calls" },
    ],
  };
}

function buildAlt(g: Graph, p: SceneParams): Scene {
  const K = 3;
  const paths = yenKShortest(g, p.source, p.target, K, p.weight);
  const markers = [marker(g, p.source, "start"), marker(g, p.target, "end")];
  if (paths.length === 0) {
    return {
      mode: "alt",
      panes: [{ label: "YEN", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes: [] }],
      markers,
      totalSteps: 2,
      algoLabel: "YEN · K-SHORTEST",
      hud: [{ label: "ROUTES", value: "0", unit: "" }],
      notice: "No route between these two points",
    };
  }
  const stats = paths.map((kp) => pathStats(g, { nodes: kp.nodes, edges: kp.edges }));
  // alternatives appear one after another so you can tell them apart
  const routes: RouteLine[] = paths.map((kp, i) => ({
    poly: pathPolyline(g, { nodes: kp.nodes, edges: kp.edges }),
    revealAt: i * 0.16,
    rank: i,
  }));
  const best = stats[0];
  const extra = (i: number) => (stats[i] ? `+${(((stats[i].time_s - best.time_s) / best.time_s) * 100).toFixed(0)}` : "—");
  return {
    mode: "alt",
    panes: [{ label: "YEN", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes }],
    markers,
    totalSteps: Math.max(2, routes[0].poly.length / 2),
    algoLabel: `YEN · ${paths.length} ROUTES`,
    hud: [
      { label: "ROUTES FOUND", value: String(paths.length), unit: "" },
      { label: "BEST DIST", value: km(best.distance_m), unit: "km" },
      { label: "BEST ETA", value: String(min(best.time_s)), unit: "min" },
      { label: "ALT 2 SLOWER", value: extra(1), unit: stats[1] ? "%" : "" },
      { label: "ALT 3 SLOWER", value: extra(2), unit: stats[2] ? "%" : "" },
    ],
  };
}
