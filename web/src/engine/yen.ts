import type { Graph, Weight } from "./types";
import { weightArray } from "./graph";
import { MinHeap } from "./heap";

export interface KPath {
  nodes: number[];
  edges: number[];
  cost: number;
}

/**
 * Shortest path from s to t that avoids a set of blocked nodes and blocked
 * *directed* edges (keyed u*N+v). Plain Dijkstra with two extra skip checks —
 * the workhorse Yen's algorithm calls repeatedly.
 */
function restrictedShortestPath(
  g: Graph,
  w: Float64Array,
  s: number,
  t: number,
  blockedNodes: Set<number>,
  blockedEdges: Set<number>,
): KPath | null {
  const n = g.nodeCount;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);
  const heap = new MinHeap(n);
  dist[s] = 0;
  heap.push(s, 0);
  const { head, to } = g;

  while (heap.size > 0) {
    const u = heap.pop();
    if (settled[u]) continue;
    settled[u] = 1;
    if (u === t) break;
    const du = dist[u];
    for (let e = head[u]; e < head[u + 1]; e++) {
      const v = to[e];
      if (settled[v] || blockedNodes.has(v)) continue;
      if (blockedEdges.has(u * n + v)) continue;
      const nd = du + w[e];
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        prevEdge[v] = e;
        heap.push(v, nd);
      }
    }
  }

  if (dist[t] === Infinity) return null;
  const nodes: number[] = [];
  const edges: number[] = [];
  let cur = t;
  while (cur !== s && cur !== -1) {
    nodes.push(cur);
    edges.push(prevEdge[cur]);
    cur = prev[cur];
  }
  if (cur !== s) return null;
  nodes.push(s);
  nodes.reverse();
  edges.reverse();
  return { nodes, edges, cost: dist[t] };
}

const sameNodes = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Yen's algorithm — the k shortest LOOPLESS paths from s to t, in non-decreasing
 * cost order. After the shortest path, each next candidate is found by "spurring"
 * off every node of the previous path: temporarily ban the edges already used by
 * shorter paths sharing that prefix (and the prefix's nodes, to stay loopless),
 * then route from the spur node to the target. The cheapest unseen candidate
 * becomes the next path. This is the principled way to get genuine alternatives.
 *
 * Complexity: O(K · V · (E + V log V)).
 */
export function yenKShortest(g: Graph, s: number, t: number, K: number, weight: Weight = "time"): KPath[] {
  const w = weightArray(g, weight);
  const n = g.nodeCount;
  const first = restrictedShortestPath(g, w, s, t, new Set(), new Set());
  if (!first) return [];
  const A: KPath[] = [first];
  const B: KPath[] = [];

  for (let k = 1; k < K; k++) {
    const prev = A[k - 1];
    for (let i = 0; i < prev.nodes.length - 1; i++) {
      const spur = prev.nodes[i];
      const root = prev.nodes.slice(0, i + 1);

      const blockedEdges = new Set<number>();
      for (const p of A) {
        if (p.nodes.length > i && sameNodes(p.nodes.slice(0, i + 1), root)) {
          blockedEdges.add(p.nodes[i] * n + p.nodes[i + 1]);
        }
      }
      const blockedNodes = new Set(root.slice(0, i)); // root minus the spur node

      const spurPath = restrictedShortestPath(g, w, spur, t, blockedNodes, blockedEdges);
      if (!spurPath) continue;

      const nodes = root.slice(0, i).concat(spurPath.nodes);
      const edges = prev.edges.slice(0, i).concat(spurPath.edges);
      let cost = 0;
      for (const e of edges) cost += w[e];
      const candidate: KPath = { nodes, edges, cost };

      if (!A.some((p) => sameNodes(p.nodes, nodes)) && !B.some((p) => sameNodes(p.nodes, nodes))) {
        B.push(candidate);
      }
    }
    if (B.length === 0) break;
    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift()!);
  }
  return A;
}
