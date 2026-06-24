import type { Graph } from "./types";
import { dijkstra } from "./dijkstra";
import { MaxFlow, FLOW_INF } from "./maxflow";
import { concaveHull } from "./hull";

export interface Containment {
  /** Min-cut value = fewest roads to cut to seal the zone from the map edge. */
  roadsCut: number;
  /** Node-id pairs of the roads to cut. */
  cutPairs: [number, number][];
  /** Source side of the cut = the sealed-in region. */
  containedMask: Uint8Array;
  containedCount: number;
  /** Concave boundary of the sealed region (world metres rings). */
  hull: Float64Array[];
  areaKm2: number;
  zoneCount: number;
  origin: number;
  feasible: boolean;
}

/**
 * Minimum-cut containment ("roadblock optimisation"). Given an origin and a time
 * budget, the reachable zone is the thing to contain. Build a flow network:
 *
 *   super-source ──∞──> every zone node
 *   every map-edge node ──∞──> super-sink
 *   each road ── capacity 1
 *
 * The max flow from source to sink equals the MINIMUM number of roads whose
 * removal disconnects the zone from the map edge (max-flow / min-cut theorem) —
 * i.e. the fewest roadblocks to seal the area. The cut edges are the roads that
 * end up saturated between the source side and the rest of the residual graph.
 *
 * On the real Munich network this naturally finds bridges/chokepoints, because
 * OSM roads only cross the Isar at actual bridges.
 */
export function containment(g: Graph, origin: number, budgetSec: number, marginFrac = 0.06): Containment {
  const n = g.nodeCount;
  const dij = dijkstra(g, origin, { weight: "time", maxCost: budgetSec });

  const b = g.bounds;
  const mX = (b.maxX - b.minX) * marginFrac;
  const mY = (b.maxY - b.minY) * marginFrac;
  const isBoundary = (i: number) =>
    g.mx[i] < b.minX + mX || g.mx[i] > b.maxX - mX || g.my[i] < b.minY + mY || g.my[i] > b.maxY - mY;

  const S = n;
  const T = n + 1;
  const mf = new MaxFlow(n + 2);
  const roadPairs: [number, number][] = [];
  for (let u = 0; u < n; u++) {
    for (let e = g.head[u]; e < g.head[u + 1]; e++) {
      mf.addEdge(u, g.to[e], 1);
      roadPairs.push([u, g.to[e]]);
    }
  }

  let zoneCount = 0;
  let sinkCount = 0;
  for (let i = 0; i < n; i++) {
    if (dij.dist[i] <= budgetSec && !isBoundary(i)) {
      mf.addEdge(S, i, FLOW_INF);
      zoneCount++;
    } else if (isBoundary(i)) {
      mf.addEdge(i, T, FLOW_INF);
      sinkCount++;
    }
  }

  const feasible = zoneCount > 0 && sinkCount > 0;
  if (!feasible) {
    return { roadsCut: 0, cutPairs: [], containedMask: new Uint8Array(n), containedCount: 0, hull: [], areaKm2: 0, zoneCount, origin, feasible: false };
  }

  mf.maxflow(S, T);
  const side = mf.minCutSide(S);

  const seen = new Set<number>();
  const cutPairs: [number, number][] = [];
  for (const [u, v] of roadPairs) {
    if (side[u] && !side[v]) {
      const key = u < v ? u * n + v : v * n + u;
      if (!seen.has(key)) {
        seen.add(key);
        cutPairs.push([u, v]);
      }
    }
  }

  const pts: [number, number][] = [];
  let containedCount = 0;
  for (let i = 0; i < n; i++) {
    if (side[i]) {
      containedCount++;
      pts.push([g.mx[i], g.my[i]]);
    }
  }
  const hull = pts.length >= 3 ? concaveHull(pts, 0.9) : { rings: [], areaKm2: 0 };

  return {
    roadsCut: cutPairs.length,
    cutPairs,
    containedMask: side,
    containedCount,
    hull: hull.rings,
    areaKm2: hull.areaKm2,
    zoneCount,
    origin,
    feasible: true,
  };
}
