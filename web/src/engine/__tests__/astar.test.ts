import { describe, it, expect } from "vitest";
import { dijkstra } from "../dijkstra";
import { astar } from "../astar";
import { reconstructPath } from "../path";
import { loadSampleGraph } from "./fixtures";

/**
 * The headline correctness guarantee: A* must return the SAME optimal cost as
 * Dijkstra on every query (its heuristic is admissible), while settling no more
 * nodes. Checked across many random pairs on the real synthetic graph.
 */
describe("astar vs dijkstra (optimality cross-check)", () => {
  const g = loadSampleGraph();
  const rng = mulberry32(42);
  const pairs = Array.from({ length: 40 }, () => [
    Math.floor(rng() * g.nodeCount),
    Math.floor(rng() * g.nodeCount),
  ]) as [number, number][];

  for (const weight of ["time", "distance"] as const) {
    it(`A* cost == Dijkstra cost for ${weight} weight`, () => {
      for (const [s, t] of pairs) {
        const d = dijkstra(g, s, { weight, target: t });
        const a = astar(g, s, t, { weight });
        if (d.dist[t] === Infinity) {
          expect(a.dist[t]).toBe(Infinity);
          continue;
        }
        // identical optimum (within float noise)
        expect(a.dist[t]).toBeCloseTo(d.dist[t], 6);
        // A* never explores more than Dijkstra with a target
        expect(a.settledCount).toBeLessThanOrEqual(d.settledCount);
      }
    });
  }

  it("A* settles strictly fewer nodes on a long cross-town query", () => {
    // opposite corners of the bounding box -> a directional query A* should win
    const s = nearestCorner(g, "sw");
    const t = nearestCorner(g, "ne");
    const d = dijkstra(g, s, { weight: "time", target: t });
    const a = astar(g, s, t, { weight: "time" });
    expect(a.dist[t]).toBeCloseTo(d.dist[t], 6);
    expect(a.settledCount).toBeLessThan(d.settledCount);
  });

  it("reconstructed A* path is contiguous and ends at the target", () => {
    const s = 10;
    const t = g.nodeCount - 50;
    const a = astar(g, s, t, { weight: "time" });
    const path = reconstructPath(a, s, t)!;
    expect(path.nodes[0]).toBe(s);
    expect(path.nodes[path.nodes.length - 1]).toBe(t);
    // every consecutive node pair is joined by the recorded edge
    for (let i = 0; i < path.edges.length; i++) {
      expect(g.to[path.edges[i]]).toBe(path.nodes[i + 1]);
    }
  });
});

function nearestCorner(g: ReturnType<typeof loadSampleGraph>, c: "sw" | "ne"): number {
  const { minX, minY, maxX, maxY } = g.bounds;
  const tx = c === "sw" ? minX : maxX;
  const ty = c === "sw" ? minY : maxY;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < g.nodeCount; i++) {
    const dx = g.mx[i] - tx;
    const dy = g.my[i] - ty;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
