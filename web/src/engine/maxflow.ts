/**
 * Maximum flow via Dinic's algorithm — the engine behind min-cut containment.
 *
 * By the max-flow / min-cut theorem, the maximum flow from a source to a sink
 * equals the minimum total capacity of edges whose removal disconnects them.
 * With unit capacities on roads, that minimum cut is exactly the FEWEST roads to
 * cut to seal one region off from another.
 *
 * Dinic builds a BFS "level graph" then pushes blocking flow along shortest
 * augmenting paths, repeating until the sink is unreachable. Far faster than
 * Edmonds-Karp on the dense, unit-capacity graphs here.
 * Complexity: O(V² E) in general; near-linear in practice on road networks.
 */
const INF = 1e9;

export class MaxFlow {
  private headArr: Int32Array;
  private to: number[] = [];
  private cap: number[] = [];
  private nxt: number[] = [];
  private level: Int32Array;
  private iter: Int32Array;
  private readonly n: number;

  constructor(n: number) {
    this.n = n;
    this.headArr = new Int32Array(n).fill(-1);
    this.level = new Int32Array(n);
    this.iter = new Int32Array(n);
  }

  /** Add a directed edge u->v with capacity c (plus its 0-capacity reverse). */
  addEdge(u: number, v: number, c: number): void {
    this.to.push(v); this.cap.push(c); this.nxt.push(this.headArr[u]); this.headArr[u] = this.to.length - 1;
    this.to.push(u); this.cap.push(0); this.nxt.push(this.headArr[v]); this.headArr[v] = this.to.length - 1;
  }

  private bfs(s: number, t: number): boolean {
    this.level.fill(-1);
    const q = new Int32Array(this.n);
    let qh = 0;
    let qt = 0;
    this.level[s] = 0;
    q[qt++] = s;
    while (qh < qt) {
      const u = q[qh++];
      for (let e = this.headArr[u]; e !== -1; e = this.nxt[e]) {
        const v = this.to[e];
        if (this.cap[e] > 0 && this.level[v] < 0) {
          this.level[v] = this.level[u] + 1;
          q[qt++] = v;
        }
      }
    }
    return this.level[t] >= 0;
  }

  private dfs(s: number, t: number, pushed: number): number {
    if (s === t) return pushed;
    // Iterative Dinic DFS — avoids call-stack overflow on long augmenting paths.
    // pathNodes/pathEdges track the current route; we augment in-place when we
    // reach t, and advance each node's current-pointer (iter) only on backtrack.
    const pathNodes: number[] = [s];
    const pathEdges: number[] = [];
    const pathFlow: number[] = [pushed];

    outer: while (pathNodes.length > 0) {
      const u = pathNodes[pathNodes.length - 1];
      const f = pathFlow[pathFlow.length - 1];

      if (u === t) {
        for (const e of pathEdges) {
          this.cap[e] -= f;
          this.cap[e ^ 1] += f;
        }
        return f;
      }

      while (this.iter[u] !== -1) {
        const e = this.iter[u];
        const v = this.to[e];
        if (this.cap[e] > 0 && this.level[v] === this.level[u] + 1) {
          pathNodes.push(v);
          pathEdges.push(e);
          pathFlow.push(Math.min(f, this.cap[e]));
          continue outer;
        }
        this.iter[u] = this.nxt[this.iter[u]];
      }

      // Dead end — backtrack and advance the parent's current-pointer past the
      // edge that brought us here so we don't revisit it.
      pathNodes.pop();
      pathFlow.pop();
      if (pathEdges.length > 0) {
        const e = pathEdges.pop()!;
        this.iter[pathNodes[pathNodes.length - 1]] = this.nxt[e];
      }
    }
    return 0;
  }

  maxflow(s: number, t: number): number {
    let flow = 0;
    while (this.bfs(s, t)) {
      for (let i = 0; i < this.n; i++) this.iter[i] = this.headArr[i];
      let f: number;
      while ((f = this.dfs(s, t, INF)) > 0) flow += f;
    }
    return flow;
  }

  /** Nodes still reachable from s in the residual graph = the source side of the min cut. */
  minCutSide(s: number): Uint8Array {
    const seen = new Uint8Array(this.n);
    const q = new Int32Array(this.n);
    let qh = 0;
    let qt = 0;
    seen[s] = 1;
    q[qt++] = s;
    while (qh < qt) {
      const u = q[qh++];
      for (let e = this.headArr[u]; e !== -1; e = this.nxt[e]) {
        if (this.cap[e] > 0 && !seen[this.to[e]]) {
          seen[this.to[e]] = 1;
          q[qt++] = this.to[e];
        }
      }
    }
    return seen;
  }
}

export const FLOW_INF = INF;
