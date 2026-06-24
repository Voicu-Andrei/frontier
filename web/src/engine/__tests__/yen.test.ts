import { describe, it, expect } from "vitest";
import { yenKShortest, penaltyAlternatives } from "../yen";
import { dijkstra } from "../dijkstra";
import { loadSampleGraph } from "./fixtures";

describe("yenKShortest", () => {
  const g = loadSampleGraph();

  it("returns up to K paths, costs non-decreasing, first == optimal", () => {
    const s = 40;
    const t = g.nodeCount - 60;
    const opt = dijkstra(g, s, { weight: "time", target: t }).dist[t];
    const paths = yenKShortest(g, s, t, 3, "time");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThanOrEqual(3);
    expect(paths[0].cost).toBeCloseTo(opt, 5);
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].cost).toBeGreaterThanOrEqual(paths[i - 1].cost - 1e-6);
    }
  });

  it("returns distinct, contiguous, loopless paths", () => {
    const s = 100;
    const t = g.nodeCount - 200;
    const paths = yenKShortest(g, s, t, 3, "time");
    const seen = new Set<string>();
    for (const p of paths) {
      // endpoints correct
      expect(p.nodes[0]).toBe(s);
      expect(p.nodes[p.nodes.length - 1]).toBe(t);
      // contiguous: each edge connects consecutive nodes
      for (let i = 0; i < p.edges.length; i++) expect(g.to[p.edges[i]]).toBe(p.nodes[i + 1]);
      // loopless: no repeated node
      expect(new Set(p.nodes).size).toBe(p.nodes.length);
      // distinct paths
      const key = p.nodes.join(",");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("penaltyAlternatives: first is optimal, rest are distinct and not cheaper", () => {
    const s = 40;
    const t = g.nodeCount - 60;
    const opt = dijkstra(g, s, { weight: "time", target: t }).dist[t];
    const paths = penaltyAlternatives(g, s, t, 3, "time");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].cost).toBeCloseTo(opt, 5);
    const keys = new Set(paths.map((p) => p.nodes.join(",")));
    expect(keys.size).toBe(paths.length); // all distinct
    for (let i = 1; i < paths.length; i++) expect(paths[i].cost).toBeGreaterThanOrEqual(opt - 1e-6);
  });
});
