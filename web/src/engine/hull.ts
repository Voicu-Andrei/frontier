import { Delaunay } from "d3-delaunay";

export interface ConcaveHull {
  /** Boundary rings (each a closed polygon, flat [x,y,...] in world metres). */
  rings: Float64Array[];
  /** Area of the largest ring, km². */
  areaKm2: number;
}

/**
 * Concave hull (alpha shape) of a point set. Builds the Delaunay triangulation,
 * drops the triangles whose longest edge is in the top `(1-keep)` fraction —
 * those are the long, thin triangles that span gaps (rivers, parks, the edge of
 * the road network) — then traces the boundary of what's left.
 *
 * Unlike a convex hull (or the old angular max-radius hull) this hugs the actual
 * reachable nodes and carves out concavities, so an isochrone built on it does
 * not bulge across water or empty fields.
 */
export function concaveHull(points: [number, number][], keep = 0.9): ConcaveHull {
  const n = points.length;
  if (n < 3) return { rings: [], areaKm2: 0 };

  const d = Delaunay.from(points);
  const tris = d.triangles;
  const ntri = tris.length / 3;
  if (ntri === 0) return { rings: [], areaKm2: 0 };

  const dist = (a: number, b: number) => Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]);
  const longest = new Float64Array(ntri);
  for (let t = 0; t < ntri; t++) {
    const a = tris[3 * t];
    const b = tris[3 * t + 1];
    const c = tris[3 * t + 2];
    longest[t] = Math.max(dist(a, b), dist(b, c), dist(c, a));
  }
  const sorted = Float64Array.from(longest).sort();
  const thresh = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * keep))];

  // Count how many kept triangles use each edge; boundary edges are used once.
  const P = n;
  const key = (a: number, b: number) => (a < b ? a * P + b : b * P + a);
  const use = new Map<number, number>();
  for (let t = 0; t < ntri; t++) {
    if (longest[t] > thresh) continue;
    const a = tris[3 * t];
    const b = tris[3 * t + 1];
    const c = tris[3 * t + 2];
    for (const k of [key(a, b), key(b, c), key(c, a)]) use.set(k, (use.get(k) ?? 0) + 1);
  }

  // Adjacency among boundary edges (used exactly once).
  const adj = new Map<number, number[]>();
  const addAdj = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const [k, count] of use) {
    if (count !== 1) continue;
    const a = Math.floor(k / P);
    const b = k % P;
    addAdj(a, b);
    addAdj(b, a);
  }

  // Walk closed rings out of the undirected boundary edges.
  const usedEdge = new Set<number>();
  const rings: Float64Array[] = [];
  for (const start of adj.keys()) {
    if (!adj.get(start)!.some((nb) => !usedEdge.has(key(start, nb)))) continue;
    const ring: number[] = [];
    let cur = start;
    let guard = 0;
    while (guard++ < n + 5) {
      ring.push(points[cur][0], points[cur][1]);
      const next = (adj.get(cur) ?? []).find((nb) => !usedEdge.has(key(cur, nb)));
      if (next === undefined) break;
      usedEdge.add(key(cur, next));
      cur = next;
      if (cur === start) break;
    }
    if (ring.length >= 6) rings.push(Float64Array.from(ring));
  }

  let area = 0;
  for (const r of rings) area = Math.max(area, ringArea(r));
  return { rings, areaKm2: area / 1e6 };
}

function ringArea(poly: Float64Array): number {
  let a = 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += poly[2 * i] * poly[2 * j + 1] - poly[2 * j] * poly[2 * i + 1];
  }
  return Math.abs(a / 2);
}
