import type { Graph, SearchResult, Weight } from "../engine/types";
import { dijkstra } from "../engine/dijkstra";
import { astar } from "../engine/astar";
import { reconstructPath, pathPolyline, pathStats } from "../engine/path";
import { isochrone } from "../engine/isochrone";
import { multiSourceDijkstra, reconstructToSource } from "../engine/multisource";
import { multiStopRoute } from "../engine/multistop";

export type Mode = "p2p" | "race" | "iso" | "multi" | "dispatch";

export interface MarkerSpec {
  x: number;
  y: number;
  role: "start" | "end" | "unit" | "job" | "stop";
  label?: string;
}

export interface Pane {
  label: string;
  colorRole: "a" | "b";
  /** Explored edges in settle order, flat [ax,ay,bx,by,...] (world metres). */
  frontier: Float64Array;
  frontierCount: number;
  /** Polylines to reveal with progress (route legs, dispatch assignments). */
  routes: Float64Array[];
}

export interface IsoLayer {
  hull: Float64Array;
  sx: number;
  sy: number;
  estRadius: number;
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

/** Build the explored-edge segment buffer from a search trace (settle order). */
function frontierSegs(g: Graph, r: SearchResult): { buf: Float64Array; count: number } {
  const tmp = new Float64Array(r.settledCount * 4);
  let n = 0;
  for (let i = 0; i < r.settledCount; i++) {
    const v = r.order[i];
    const u = r.prev[v];
    if (u < 0) continue;
    tmp[n++] = g.mx[u];
    tmp[n++] = g.my[u];
    tmp[n++] = g.mx[v];
    tmp[n++] = g.my[v];
  }
  return { buf: tmp.subarray(0, n), count: n / 4 };
}

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}

function marker(g: Graph, node: number, role: MarkerSpec["role"], label?: string): MarkerSpec {
  return { x: g.mx[node], y: g.my[node], role, label };
}

export function buildScene(g: Graph, p: SceneParams): Scene {
  switch (p.mode) {
    case "race":
      return buildRace(g, p);
    case "iso":
      return buildIso(g, p);
    case "multi":
      return buildMulti(g, p);
    case "dispatch":
      return buildDispatch(g, p);
    default:
      return buildP2P(g, p);
  }
}

function pane(g: Graph, r: SearchResult, label: string, colorRole: "a" | "b", routes: Float64Array[]): Pane {
  const f = frontierSegs(g, r);
  return { label, colorRole, frontier: f.buf, frontierCount: f.count, routes };
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
      { label: "TURNS", value: stats ? String(stats.turns) : "—", unit: "" },
      { label: "NODES EXPLORED", value: r.settledCount.toLocaleString("en-US"), unit: "" },
      { label: "RUNTIME", value: ms.toFixed(1), unit: "ms" },
    ],
  };
}

function buildRace(g: Graph, p: SceneParams): Scene {
  const d = timed(() => dijkstra(g, p.source, { weight: p.weight, target: p.target }));
  const a = timed(() => astar(g, p.source, p.target, { weight: p.weight }));
  const dPath = reconstructPath(d.value, p.source, p.target);
  const aPath = reconstructPath(a.value, p.source, p.target);
  const dRoute = dPath ? [pathPolyline(g, dPath)] : [];
  const aRoute = aPath ? [pathPolyline(g, aPath)] : [];
  const speedup = a.value.settledCount > 0 ? d.value.settledCount / a.value.settledCount : 1;
  return {
    mode: "race",
    panes: [
      pane(g, d.value, "DIJKSTRA", "a", dRoute),
      pane(g, a.value, "A★", "b", aRoute),
    ],
    markers: [marker(g, p.source, "start"), marker(g, p.target, "end")],
    totalSteps: Math.max(d.value.settledCount, a.value.settledCount),
    algoLabel: "DIJKSTRA × A★",
    race: {
      aNodes: d.value.settledCount,
      aMs: d.ms,
      bNodes: a.value.settledCount,
      bMs: a.ms,
      speedup,
    },
    hud: [
      { label: "LEADER", value: a.value.settledCount < d.value.settledCount ? "A★" : "DIJK", unit: "" },
      { label: "FEWER NODES", value: `${(speedup).toFixed(1)}`, unit: "×" },
      { label: "Δ NODES", value: Math.max(0, d.value.settledCount - a.value.settledCount).toLocaleString("en-US"), unit: "" },
      { label: "RUNTIME", value: `${d.ms.toFixed(0)}/${a.ms.toFixed(0)}`, unit: "ms" },
    ],
  };
}

function buildIso(g: Graph, p: SceneParams): Scene {
  const budget = p.isoBudgetMin * 60;
  const iso = isochrone(g, p.source, budget, "time");
  return {
    mode: "iso",
    panes: [pane(g, iso.result, "DIJKSTRA", "a", [])],
    markers: [marker(g, p.source, "start")],
    iso: { hull: iso.hull, sx: g.mx[p.source], sy: g.my[p.source], estRadius: iso.estRadius, result: iso.result, budget },
    totalSteps: iso.result.settledCount,
    algoLabel: "DIJKSTRA · ISOCHRONE",
    hud: [
      { label: "REACHABLE AREA", value: iso.areaKm2.toFixed(1), unit: "km²" },
      { label: "MAX TIME", value: String(p.isoBudgetMin), unit: "min" },
      { label: "NODES REACHED", value: iso.reachable.toLocaleString("en-US"), unit: "" },
      { label: "EST. RADIUS", value: (iso.estRadius / 1000).toFixed(1), unit: "km" },
    ],
  };
}

function buildMulti(g: Graph, p: SceneParams): Scene {
  const ms = multiStopRoute(g, p.stops, p.weight);
  const markers: MarkerSpec[] = ms.order.map((node, i) =>
    marker(g, node, i === 0 ? "start" : "stop", i === 0 ? "S" : String(i)),
  );
  return {
    mode: "multi",
    panes: [{ label: "A★", colorRole: "a", frontier: new Float64Array(0), frontierCount: 0, routes: [ms.polyline] }],
    markers,
    totalSteps: Math.max(2, ms.polyline.length / 2),
    algoLabel: "TSP · NEAREST-NEIGHBOUR",
    hud: [
      { label: "STOPS", value: String(p.stops.length), unit: "" },
      { label: "TOTAL DIST", value: km(ms.distance_m), unit: "km" },
      { label: "ETA", value: String(min(ms.time_s)), unit: "min" },
      { label: "ORDER", value: "OPT*", unit: "" },
    ],
  };
}

function buildDispatch(g: Graph, p: SceneParams): Scene {
  const r = multiSourceDijkstra(g, p.units, { weight: p.weight });
  const routes: Float64Array[] = [];
  let assigned = 0;
  let etaSum = 0;
  for (const job of p.jobs) {
    const chain = reconstructToSource(r, job);
    if (!chain) continue;
    assigned++;
    etaSum += r.dist[job];
    const poly: number[] = [];
    for (const node of chain.nodes) poly.push(g.mx[node], g.my[node]);
    routes.push(Float64Array.from(poly));
  }
  const markers: MarkerSpec[] = [
    ...p.units.map((u) => marker(g, u, "unit")),
    ...p.jobs.map((j) => marker(g, j, "job")),
  ];
  return {
    mode: "dispatch",
    panes: [pane(g, r, "MULTI-SOURCE", "a", routes)],
    markers,
    totalSteps: r.settledCount,
    algoLabel: "MULTI-SOURCE · DISPATCH",
    hud: [
      { label: "UNITS", value: String(p.units.length), unit: "" },
      { label: "CALLS", value: String(p.jobs.length), unit: "" },
      { label: "ASSIGNED", value: String(assigned), unit: "" },
      { label: "AVG ETA", value: assigned ? String(min(etaSum / assigned)) : "—", unit: "min" },
    ],
  };
}
