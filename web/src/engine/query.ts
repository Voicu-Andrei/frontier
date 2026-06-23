import type { Graph, SearchResult, Weight } from "./types";
import { dijkstra } from "./dijkstra";
import { astar } from "./astar";
import { reconstructPath, pathPolyline, pathStats, type Path, type PathStats } from "./path";

export type Algorithm = "dijkstra" | "astar";

export const ALGORITHM_LABEL: Record<Algorithm, string> = {
  dijkstra: "DIJKSTRA",
  astar: "A★",
};

export interface RouteResult {
  algorithm: Algorithm;
  result: SearchResult;
  path: Path | null;
  polyline: Float64Array;
  stats: PathStats | null;
  settled: number;
}

/** Run one algorithm point-to-point and assemble everything the UI needs. */
export function computeRoute(
  g: Graph,
  source: number,
  target: number,
  algorithm: Algorithm,
  weight: Weight,
): RouteResult {
  const result =
    algorithm === "astar"
      ? astar(g, source, target, { weight })
      : dijkstra(g, source, { target, weight });
  const path = reconstructPath(result, source, target);
  return {
    algorithm,
    result,
    path,
    polyline: path ? pathPolyline(g, path) : new Float64Array(0),
    stats: path ? pathStats(g, path) : null,
    settled: result.settledCount,
  };
}

export interface BenchRow {
  algorithm: Algorithm;
  settled: number;
  ms: number;
  distance_m: number;
  time_s: number;
}

/**
 * Empirical benchmark: run each algorithm `trials` times on the same query and
 * report the median wall-clock time plus nodes settled. No rendering or tracing
 * overhead is in the timed loop — this is what turns big-O claims into measured
 * evidence in race mode.
 */
export function benchmark(
  g: Graph,
  source: number,
  target: number,
  weight: Weight,
  trials = 5,
): BenchRow[] {
  const algos: Algorithm[] = ["dijkstra", "astar"];
  return algos.map((algorithm) => {
    const times: number[] = [];
    let settled = 0;
    for (let i = 0; i < trials; i++) {
      const t0 = performance.now();
      const r =
        algorithm === "astar"
          ? astar(g, source, target, { weight })
          : dijkstra(g, source, { target, weight });
      times.push(performance.now() - t0);
      settled = r.settledCount;
    }
    times.sort((a, b) => a - b);
    const route = computeRoute(g, source, target, algorithm, weight);
    return {
      algorithm,
      settled,
      ms: times[times.length >> 1],
      distance_m: route.stats?.distance_m ?? 0,
      time_s: route.stats?.time_s ?? 0,
    };
  });
}
