import type { Graph, SearchOptions } from "./types";
import { weightArray } from "./graph";
import { MinHeap } from "./heap";
import type { Path } from "./path";

export interface BidirResult {
  // forward search (from source)
  distF: Float64Array;
  prevF: Int32Array;
  prevEdgeF: Int32Array;
  orderF: Int32Array;
  settledF: number;
  // backward search (from target, over the reverse graph)
  distB: Float64Array;
  prevB: Int32Array;
  prevEdgeB: Int32Array; // original forward edge id (node -> prevB[node])
  orderB: Int32Array;
  settledB: number;
  // outcome
  meet: number; // node where the two searches met (-1 if unreachable)
  cost: number;
  source: number;
  target: number;
}

/**
 * Bidirectional Dijkstra — the "search from both ends and meet in the middle"
 * idea (this is what makes production routers fast). A forward search grows from
 * the source over the graph; a backward search grows from the target over the
 * *reverse* graph. Each settles a roughly half-radius ball, so together they
 * touch far fewer nodes than a single search settling one full-radius ball.
 *
 * Termination: stop once the smallest unprocessed key on each side sums to at
 * least the best meeting cost `mu` found so far — no shorter path can remain.
 *
 * Complexity: same O((V+E) log V) bound as Dijkstra, but typically ~2x fewer
 * settled nodes on long queries (shown live in the readout / Race-style story).
 */
export function bidirectional(g: Graph, source: number, target: number, opts: SearchOptions = {}): BidirResult {
  const w = weightArray(g, opts.weight ?? "time");
  const n = g.nodeCount;

  const distF = new Float64Array(n).fill(Infinity);
  const distB = new Float64Array(n).fill(Infinity);
  const prevF = new Int32Array(n).fill(-1);
  const prevB = new Int32Array(n).fill(-1);
  const prevEdgeF = new Int32Array(n).fill(-1);
  const prevEdgeB = new Int32Array(n).fill(-1);
  const orderF = new Int32Array(n);
  const orderB = new Int32Array(n);
  const doneF = new Uint8Array(n);
  const doneB = new Uint8Array(n);
  let settledF = 0;
  let settledB = 0;

  const heapF = new MinHeap(n);
  const heapB = new MinHeap(n);
  distF[source] = 0;
  distB[target] = 0;
  heapF.push(source, 0);
  heapB.push(target, 0);

  const { head, to, rhead, rto, rEdge } = g;
  let mu = Infinity;
  let meet = -1;

  if (source === target) {
    return { distF, prevF, prevEdgeF, orderF, settledF: 0, distB, prevB, prevEdgeB, orderB, settledB: 0, meet: source, cost: 0, source, target };
  }

  while (heapF.size > 0 && heapB.size > 0) {
    // stop when no crossing path can beat the best meeting found so far
    if (heapF.topKey() + heapB.topKey() >= mu) break;

    // advance the side whose frontier is currently cheaper (keeps the balls balanced)
    if (heapF.topKey() <= heapB.topKey()) {
      const u = heapF.pop();
      if (doneF[u]) continue;
      doneF[u] = 1;
      orderF[settledF++] = u;
      const du = distF[u];
      for (let e = head[u]; e < head[u + 1]; e++) {
        const v = to[e];
        const nd = du + w[e];
        if (nd < distF[v]) {
          distF[v] = nd;
          prevF[v] = u;
          prevEdgeF[v] = e;
          heapF.push(v, nd);
        }
      }
      if (distB[u] + du < mu) {
        mu = distB[u] + du;
        meet = u;
      }
    } else {
      const u = heapB.pop();
      if (doneB[u]) continue;
      doneB[u] = 1;
      orderB[settledB++] = u;
      const du = distB[u];
      for (let e = rhead[u]; e < rhead[u + 1]; e++) {
        const v = rto[e]; // original edge v -> u exists
        const nd = du + w[rEdge[e]];
        if (nd < distB[v]) {
          distB[v] = nd;
          prevB[v] = u;
          prevEdgeB[v] = rEdge[e];
          heapB.push(v, nd);
        }
      }
      if (distF[u] + du < mu) {
        mu = distF[u] + du;
        meet = u;
      }
    }
  }

  return { distF, prevF, prevEdgeF, orderF, settledF, distB, prevB, prevEdgeB, orderB, settledB, meet, cost: mu, source, target };
}

/** Reconstruct the full path through the meeting node. */
export function reconstructBidir(r: BidirResult): Path | null {
  if (r.meet === -1) return null;
  // source -> meet (follow forward predecessors, then reverse)
  const fNodes: number[] = [];
  const fEdges: number[] = [];
  let cur = r.meet;
  while (cur !== r.source && cur !== -1) {
    fNodes.push(cur);
    fEdges.push(r.prevEdgeF[cur]);
    cur = r.prevF[cur];
  }
  if (cur !== r.source) return null;
  fNodes.push(r.source);
  fNodes.reverse();
  fEdges.reverse();

  // meet -> target (follow backward predecessors forward)
  const bNodes: number[] = [];
  const bEdges: number[] = [];
  cur = r.meet;
  while (cur !== r.target && cur !== -1) {
    bEdges.push(r.prevEdgeB[cur]);
    cur = r.prevB[cur];
    bNodes.push(cur);
  }
  if (cur !== r.target) return null;

  return { nodes: [...fNodes, ...bNodes], edges: [...fEdges, ...bEdges] };
}
