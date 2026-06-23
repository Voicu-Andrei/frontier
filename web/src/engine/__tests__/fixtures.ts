import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildGraph } from "../graph";
import type { Graph, RawGraph } from "../types";

/** Build a RawGraph from a terse edge list (auto two-way unless oneway). */
export function makeRaw(
  nodes: [number, number][], // [lon, lat]
  edges: [number, number, number, number?][], // [from, to, weight, klass?]
  oneway = false,
): RawGraph {
  const from: number[] = [];
  const to: number[] = [];
  const len_m: number[] = [];
  const time_s: number[] = [];
  const klass: number[] = [];
  const add = (a: number, b: number, w: number, k: number) => {
    from.push(a);
    to.push(b);
    len_m.push(w);
    time_s.push(w);
    klass.push(k);
  };
  for (const [a, b, w, k = 5] of edges) {
    add(a, b, w, k);
    if (!oneway) add(b, a, w, k);
  }
  const lon = nodes.map((n) => n[0]);
  const lat = nodes.map((n) => n[1]);
  return {
    meta: {
      name: "test",
      directed: true,
      center: [lon.reduce((s, v) => s + v, 0) / lon.length, lat.reduce((s, v) => s + v, 0) / lat.length],
      bbox: [Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat)],
      speeds_kmh: { residential: 30, motorway: 100 },
      source: "test",
      node_count: nodes.length,
      edge_count: from.length,
    },
    nodes: { lon, lat },
    edges: { from, to, len_m, time_s, klass, geom: null },
  };
}

/** Load the committed synthetic Munich graph for end-to-end tests. */
export function loadSampleGraph(): Graph {
  const url = new URL("../../../public/data/munich-sample.graph.json", import.meta.url);
  const raw = JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as RawGraph;
  return buildGraph(raw);
}

/** Tiny directed graph with a hand-computed shortest path 0->2 = 3 via 0-3-4-2. */
export function tinyGraph(): Graph {
  const raw = makeRaw(
    [
      [11.0, 48.0],
      [11.01, 48.0],
      [11.02, 48.0],
      [11.0, 47.99],
      [11.01, 47.99],
    ],
    [
      [0, 1, 2],
      [1, 2, 2],
      [0, 3, 1],
      [3, 4, 1],
      [4, 2, 1],
      [1, 4, 3],
    ],
  );
  return buildGraph(raw);
}
