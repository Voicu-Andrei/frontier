import { describe, it, expect } from "vitest";
import { concaveHull } from "../hull";

describe("concaveHull", () => {
  it("returns nothing for fewer than 3 points", () => {
    expect(concaveHull([]).rings).toHaveLength(0);
    expect(concaveHull([[0, 0]]).rings).toHaveLength(0);
    expect(concaveHull([[0, 0], [1, 1]]).rings).toHaveLength(0);
  });

  it("wraps a filled grid with area close to its bounding box", () => {
    const pts: [number, number][] = [];
    for (let x = 0; x <= 100; x += 10) for (let y = 0; y <= 100; y += 10) pts.push([x, y]);
    const h = concaveHull(pts, 0.95);
    expect(h.rings.length).toBeGreaterThan(0);
    // area is in km² because the util divides by 1e6; here coords are "metres"
    // so 100x100 = 10000 m² = 0.01 km². Allow generous tolerance for the hull.
    expect(h.areaKm2).toBeGreaterThan(0.006);
    expect(h.areaKm2).toBeLessThan(0.0125);
  });

  it("never encloses more than the convex bounding box", () => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      pts.push([100 + Math.cos(a) * 80, 100 + Math.sin(a) * 50]); // ellipse outline
    }
    const h = concaveHull(pts, 0.85);
    expect(h.rings.length).toBeGreaterThan(0);
    // bounding box = 160 x 100 = 16000 m² = 0.016 km²; hull must fit inside it
    expect(h.areaKm2).toBeGreaterThan(0);
    expect(h.areaKm2).toBeLessThanOrEqual(0.016);
  });
});
