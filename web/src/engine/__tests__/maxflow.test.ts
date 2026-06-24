import { describe, it, expect } from "vitest";
import { MaxFlow } from "../maxflow";
import { containment } from "../containment";
import { loadSampleGraph } from "./fixtures";

describe("MaxFlow (Dinic)", () => {
  it("matches the classic CLRS max-flow example (value 23)", () => {
    const mf = new MaxFlow(6);
    const E: [number, number, number][] = [
      [0, 1, 16], [0, 2, 13], [1, 2, 10], [2, 1, 4], [1, 3, 12],
      [3, 2, 9], [2, 4, 14], [4, 3, 7], [3, 5, 20], [4, 5, 4],
    ];
    for (const [u, v, c] of E) mf.addEdge(u, v, c);
    expect(mf.maxflow(0, 5)).toBe(23);
  });

  it("min cut value equals max flow on a tiny bottleneck", () => {
    // s -> a (5), a -> t (3): the a->t edge is the bottleneck => max flow 3
    const mf = new MaxFlow(4);
    mf.addEdge(0, 1, 5);
    mf.addEdge(1, 3, 3);
    expect(mf.maxflow(0, 3)).toBe(3);
    const side = mf.minCutSide(0);
    expect(side[0]).toBe(1);
    expect(side[1]).toBe(1); // a still reachable (s->a not saturated)
    expect(side[3]).toBe(0); // t on the far side
  });
});

describe("containment (min-cut roadblocks)", () => {
  const g = loadSampleGraph();

  it("produces a valid, consistent cut around an interior origin", () => {
    const origin = Math.floor(g.nodeCount / 2);
    const c = containment(g, origin, 4 * 60); // 4-minute zone
    expect(c.feasible).toBe(true);
    expect(c.roadsCut).toBeGreaterThan(0);
    expect(c.containedCount).toBeGreaterThan(0);
    // every cut road crosses from the sealed side to the outside
    for (const [u, v] of c.cutPairs) {
      expect(c.containedMask[u]).toBe(1);
      expect(c.containedMask[v]).toBe(0);
    }
  });
});
