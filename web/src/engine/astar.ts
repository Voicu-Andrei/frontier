import type { Graph, SearchOptions, SearchResult } from "./types";
import { weightArray } from "./graph";
import { MinHeap } from "./heap";

/** Fastest free-flow speed in the dataset, m/s — used for the time heuristic. */
function maxSpeedMps(g: Graph): number {
  const speeds = Object.values(g.meta.speeds_kmh);
  const kmh = speeds.length ? Math.max(...speeds) : 100;
  return (kmh * 1000) / 3600;
}

/**
 * A* — Dijkstra steered by an admissible, consistent heuristic toward a single
 * target. Same settle/relax loop as Dijkstra, but the priority is
 * `g(n) + h(n)`, where `h` is a straight-line lower bound on the remaining cost:
 *
 *   - distance weight: Euclidean ground distance to the target (metres)
 *   - time weight:     that distance divided by the network's top speed
 *
 * Both never overestimate, so the path A* returns is provably optimal — verified
 * against Dijkstra in the tests. With a good heuristic it settles far fewer
 * nodes, which the benchmark mode measures.
 *
 * Complexity: O((V + E) log V) worst case; far fewer expansions in practice.
 */
export function astar(g: Graph, source: number, target: number, opts: SearchOptions = {}): SearchResult {
  const w = weightArray(g, opts.weight ?? "time");
  const useTime = (opts.weight ?? "time") === "time";
  const invSpeed = useTime ? 1 / maxSpeedMps(g) : 1;
  const n = g.nodeCount;
  const { mx, my, head, to } = g;
  const tx = mx[target];
  const ty = my[target];

  const h = (node: number): number => {
    const dx = mx[node] - tx;
    const dy = my[node] - ty;
    return Math.sqrt(dx * dx + dy * dy) * invSpeed;
  };

  const dist = new Float64Array(n).fill(Infinity); // g-score
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const settled = new Uint8Array(n);
  let settledCount = 0;

  const heap = new MinHeap(n);
  dist[source] = 0;
  heap.push(source, h(source));

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
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        prevEdge[v] = e;
        heap.push(v, nd + h(v));
      }
    }
  }

  return { dist, prev, prevEdge, order, settledCount, found, target };
}
