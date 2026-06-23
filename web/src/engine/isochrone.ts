import type { Graph, SearchResult, Weight } from "./types";
import { dijkstra } from "./dijkstra";
import { concaveHull, type ConcaveHull } from "./hull";

export interface Isochrone {
  result: SearchResult;
  /** Nodes reachable within the full budget. */
  reachable: number;
  budgetSeconds: number;
  source: number;
  /** Concave boundary of the reachable nodes (hugs roads, carves out gaps). */
  hull: ConcaveHull;
  /** Time-band thresholds in seconds (ascending), for colouring streets. */
  bands: number[];
}

/**
 * Isochrone = bounded Dijkstra with no target. "How far can someone get from
 * here in N minutes?" Uses the TIME weight, so it fully respects road-class
 * speeds — you get much further along motorways/arterials than residential
 * streets. The reachable streets are coloured into time bands and wrapped in a
 * concave hull, so the boundary follows the network instead of ballooning into
 * water or fields.
 */
export function isochrone(g: Graph, source: number, budgetSeconds: number, weight: Weight = "time"): Isochrone {
  const result = dijkstra(g, source, { weight, maxCost: budgetSeconds });
  const pts: [number, number][] = [];
  for (let i = 0; i < g.nodeCount; i++) {
    if (result.dist[i] !== Infinity) pts.push([g.mx[i], g.my[i]]);
  }
  const hull = concaveHull(pts, 0.9);
  const bands = [budgetSeconds / 3, (2 * budgetSeconds) / 3, budgetSeconds];
  return { result, reachable: pts.length, budgetSeconds, source, hull, bands };
}
