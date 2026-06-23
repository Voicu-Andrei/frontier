import type { Graph, Weight } from "./types";
import { astar } from "./astar";
import { reconstructPath, pathPolyline, type Path } from "./path";

export interface MultiStopRoute {
  /** Stops in visiting order (first stop fixed as the start). */
  order: number[];
  /** Concatenated path through the ordered stops. */
  polyline: Float64Array;
  distance_m: number;
  time_s: number;
  legs: Path[];
}

/**
 * Multi-stop routing. The optimal stop order is the Travelling Salesman Problem
 * (NP-hard); this uses the nearest-neighbour heuristic over an all-pairs cost
 * matrix built from the core engine, then stitches the real road paths between
 * consecutive stops. (Exact Held-Karp for small n is a planned upgrade.)
 */
export function multiStopRoute(g: Graph, stops: number[], weight: Weight = "time"): MultiStopRoute {
  const k = stops.length;
  // all-pairs costs via the engine (A* between each pair of stops)
  const cost: number[][] = Array.from({ length: k }, () => new Array(k).fill(Infinity));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      cost[i][j] = astar(g, stops[i], stops[j], { weight }).dist[stops[j]];
    }
  }

  // nearest-neighbour tour starting at stop 0
  const visited = new Array(k).fill(false);
  const order = [0];
  visited[0] = true;
  for (let step = 1; step < k; step++) {
    const last = order[order.length - 1];
    let best = -1;
    let bestC = Infinity;
    for (let j = 0; j < k; j++) {
      if (!visited[j] && cost[last][j] < bestC) {
        bestC = cost[last][j];
        best = j;
      }
    }
    order.push(best);
    visited[best] = true;
  }

  // stitch real paths between consecutive stops
  const legs: Path[] = [];
  const poly: number[] = [];
  let distance_m = 0;
  let time_s = 0;
  for (let i = 0; i < order.length - 1; i++) {
    const s = stops[order[i]];
    const t = stops[order[i + 1]];
    const r = astar(g, s, t, { weight });
    const path = reconstructPath(r, s, t);
    if (!path) continue;
    legs.push(path);
    const line = pathPolyline(g, path);
    const start = i === 0 ? 0 : 2; // skip duplicated joint vertex
    for (let p = start; p < line.length; p += 2) poly.push(line[p], line[p + 1]);
    for (const e of path.edges) {
      if (e < 0) continue;
      distance_m += g.len_m[e];
      time_s += g.time_s[e];
    }
  }

  return {
    order: order.map((i) => stops[i]),
    polyline: Float64Array.from(poly),
    distance_m,
    time_s,
    legs,
  };
}
