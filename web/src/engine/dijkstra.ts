import type { Graph, SearchOptions, SearchResult } from "./types";
import { weightArray } from "./graph";
import { MinHeap } from "./heap";

/**
 * Dijkstra's algorithm — the baseline shortest-path search and the engine every
 * other feature wraps. Single source, optional target (early-exit) and optional
 * cost ceiling (bounded search for isochrones / multi-source).
 *
 * Records the settle order as the visitation trace. This runs to completion in
 * one shot; the UI replays `order` frame by frame, so animation never perturbs
 * the algorithm or its timing.
 *
 * Complexity: O((V + E) log V) with the binary heap.
 */
export function dijkstra(g: Graph, source: number, opts: SearchOptions = {}): SearchResult {
  const { target = -1, maxCost = Infinity } = opts;
  const w = weightArray(g, opts.weight ?? "time");
  const n = g.nodeCount;

  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const settled = new Uint8Array(n);
  let settledCount = 0;

  const heap = new MinHeap(n);
  dist[source] = 0;
  heap.push(source, 0);

  const { head, to } = g;
  let found = false;

  while (heap.size > 0) {
    const u = heap.pop();
    if (settled[u]) continue;
    settled[u] = 1;
    order[settledCount++] = u;

    if (u === target) {
      found = true;
      break;
    }

    const du = dist[u];
    for (let e = head[u]; e < head[u + 1]; e++) {
      const v = to[e];
      if (settled[v]) continue;
      const nd = du + w[e];
      if (nd > maxCost) continue;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        prevEdge[v] = e;
        heap.push(v, nd);
      }
    }
  }

  return { dist, prev, prevEdge, order, settledCount, found, target };
}
