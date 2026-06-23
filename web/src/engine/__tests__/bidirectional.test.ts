import { describe, it, expect } from "vitest";
import { dijkstra } from "../dijkstra";
import { bidirectional, reconstructBidir } from "../bidirectional";
import { loadSampleGraph } from "./fixtures";

describe("bidirectional Dijkstra", () => {
  const g = loadSampleGraph();
  const rng = mulberry32(7);
  const pairs = Array.from({ length: 30 }, () => [
    Math.floor(rng() * g.nodeCount),
    Math.floor(rng() * g.nodeCount),
  ]) as [number, number][];

  for (const weight of ["time", "distance"] as const) {
    it(`finds the same optimal cost as Dijkstra (${weight})`, () => {
      for (const [s, t] of pairs) {
        if (s === t) continue;
        const d = dijkstra(g, s, { weight, target: t });
        const b = bidirectional(g, s, t, { weight });
        expect(b.cost).toBeCloseTo(d.dist[t], 5);
      }
    });
  }

  it("settles fewer nodes than one-directional Dijkstra on a long query", () => {
    const s = 30;
    const t = g.nodeCount - 40;
    const d = dijkstra(g, s, { weight: "time", target: t });
    const b = bidirectional(g, s, t, { weight: "time" });
    expect(b.cost).toBeCloseTo(d.dist[t], 5);
    expect(b.settledF + b.settledB).toBeLessThan(d.settledCount);
  });

  it("reconstructs a contiguous path from start to end", () => {
    const s = 12;
    const t = g.nodeCount - 100;
    const b = bidirectional(g, s, t, { weight: "time" });
    const path = reconstructBidir(b)!;
    expect(path.nodes[0]).toBe(s);
    expect(path.nodes[path.nodes.length - 1]).toBe(t);
    for (let i = 0; i < path.edges.length; i++) {
      expect(g.to[path.edges[i]]).toBe(path.nodes[i + 1]);
    }
  });
});

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
