import type { Graph, SearchResult, Weight } from "./types";
import { weightArray } from "./graph";
import { MinHeap } from "./heap";

export interface MultiSourceResult extends SearchResult {
  /** For each node, the index (into `sources`) of the nearest source. */
  origin: Int32Array;
}

/**
 * Multi-source Dijkstra: seed the queue with several sources at cost 0 and let
 * them compete. Each node ends up labelled with its nearest source — exactly the
 * "which unit reaches this call first" question for dispatch. One search instead
 * of one-per-unit. The settle order is still a valid expanding-frontier trace.
 */
export function multiSourceDijkstra(
  g: Graph,
  sources: number[],
  opts: { weight?: Weight; maxCost?: number } = {},
): MultiSourceResult {
  const w = weightArray(g, opts.weight ?? "time");
  const maxCost = opts.maxCost ?? Infinity;
  const n = g.nodeCount;

  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const origin = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const settled = new Uint8Array(n);
  let settledCount = 0;

  const heap = new MinHeap(n);
  sources.forEach((s, i) => {
    dist[s] = 0;
    origin[s] = i;
    heap.push(s, 0);
  });

  const { head, to } = g;
  while (heap.size > 0) {
    const u = heap.pop();
    if (settled[u]) continue;
    settled[u] = 1;
    order[settledCount++] = u;

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
        origin[v] = origin[u];
        heap.push(v, nd);
      }
    }
  }

  return { dist, prev, prevEdge, order, settledCount, found: false, target: -1, origin };
}

/** Walk predecessors from `node` back to whichever source it belongs to. */
export function reconstructToSource(
  result: SearchResult,
  node: number,
): { nodes: number[]; edges: number[] } | null {
  if (result.dist[node] === Infinity) return null;
  const nodes: number[] = [];
  const edges: number[] = [];
  let cur = node;
  while (cur !== -1) {
    nodes.push(cur);
    const e = result.prevEdge[cur];
    if (e === -1) break;
    edges.push(e);
    cur = result.prev[cur];
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges };
}
