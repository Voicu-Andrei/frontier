import { describe, it, expect } from "vitest";
import { dijkstra } from "../dijkstra";
import { reconstructPath, pathStats } from "../path";
import { tinyGraph } from "./fixtures";

describe("dijkstra", () => {
  const g = tinyGraph();

  it("finds the hand-computed optimum on a tiny graph", () => {
    const r = dijkstra(g, 0, { weight: "distance" });
    // 0->2 best is 0-3-4-2 (cost 3), not 0-1-2 (cost 4)
    expect(r.dist[2]).toBe(3);
    expect(r.dist[1]).toBe(2);
    expect(r.dist[4]).toBe(2);
    const path = reconstructPath(r, 0, 2)!;
    expect(path.nodes).toEqual([0, 3, 4, 2]);
  });

  it("early-exits when the target is settled", () => {
    const r = dijkstra(g, 0, { weight: "distance", target: 3 });
    expect(r.found).toBe(true);
    // target 3 has cost 1, so it settles before farther nodes; not all 5 settle
    expect(r.settledCount).toBeLessThan(g.nodeCount);
    expect(r.order[r.settledCount - 1]).toBe(3);
  });

  it("honours a cost ceiling (bounded search)", () => {
    const r = dijkstra(g, 0, { weight: "distance", maxCost: 2 });
    // node 2 (cost 3) is beyond the budget and must stay unreached
    expect(r.dist[2]).toBe(Infinity);
    expect(r.dist[4]).toBe(2);
  });

  it("settle order is non-decreasing in cost", () => {
    const r = dijkstra(g, 0, { weight: "distance" });
    for (let i = 1; i < r.settledCount; i++) {
      expect(r.dist[r.order[i]]).toBeGreaterThanOrEqual(r.dist[r.order[i - 1]]);
    }
  });

  it("path stats sum edge attributes", () => {
    const r = dijkstra(g, 0, { weight: "distance" });
    const stats = pathStats(g, reconstructPath(r, 0, 2)!);
    expect(stats.distance_m).toBe(3);
  });
});
