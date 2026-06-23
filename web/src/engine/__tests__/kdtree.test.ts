import { describe, it, expect } from "vitest";
import { KDTree } from "../kdtree";
import { loadSampleGraph } from "./fixtures";

describe("KDTree nearest-node", () => {
  const g = loadSampleGraph();
  const tree = new KDTree(g);

  const brute = (x: number, y: number): number => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < g.nodeCount; i++) {
      const dx = g.mx[i] - x;
      const dy = g.my[i] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  it("matches brute-force nearest for random query points", () => {
    const { minX, minY, maxX, maxY } = g.bounds;
    let rng = 123456789;
    const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let k = 0; k < 200; k++) {
      const x = minX + rand() * (maxX - minX);
      const y = minY + rand() * (maxY - minY);
      // compare by distance (ties allowed), not just id
      const kd = tree.nearest(x, y);
      const bf = brute(x, y);
      const d2 = (i: number) => (g.mx[i] - x) ** 2 + (g.my[i] - y) ** 2;
      expect(d2(kd)).toBeCloseTo(d2(bf), 6);
    }
  });

  it("returns a node exactly on top of a node", () => {
    const id = 777;
    expect(tree.nearest(g.mx[id], g.my[id])).toBe(id);
  });
});
