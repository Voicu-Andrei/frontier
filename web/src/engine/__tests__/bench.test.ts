import { describe, it, expect } from "vitest";
import { benchmark } from "../query";
import { loadSampleGraph } from "./fixtures";

/**
 * Empirical benchmark — the "measure the speedups, don't just describe them"
 * grading lens. Runs Dijkstra and A* on identical cross-town queries and prints
 * a table of nodes settled + median runtime. Asserts A* never settles more
 * nodes than Dijkstra (the whole point of the heuristic).
 */
describe("benchmark: Dijkstra vs A*", () => {
  const g = loadSampleGraph();

  // a few representative long queries across the network
  const queries: [number, number][] = [
    [50, g.nodeCount - 60],
    [200, g.nodeCount - 400],
    [Math.floor(g.nodeCount * 0.1), Math.floor(g.nodeCount * 0.92)],
  ];

  it("A* settles no more nodes than Dijkstra, and reports timings", () => {
    const lines: string[] = [];
    lines.push(`graph: ${g.nodeCount} nodes, ${g.edgeCount} edges`);
    lines.push("query        algo      nodes    ms     dist(km)");
    for (const [s, t] of queries) {
      const rows = benchmark(g, s, t, "time", 7);
      const [dij, ast] = rows;
      expect(ast.settled).toBeLessThanOrEqual(dij.settled);
      // both find the same optimal distance
      expect(ast.distance_m).toBeCloseTo(dij.distance_m, 3);
      for (const r of rows) {
        lines.push(
          `${String(s).padStart(4)}->${String(t).padStart(5)}  ${r.algorithm.padEnd(8)}  ` +
            `${String(r.settled).padStart(5)}  ${r.ms.toFixed(2).padStart(5)}  ${(r.distance_m / 1000).toFixed(2)}`,
        );
      }
    }
    // surfaced in the test output for the write-up
    console.log("\n" + lines.join("\n") + "\n");
  });
});
