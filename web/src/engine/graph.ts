import type { Graph, RawGraph, ProjectedFeatures } from "./types";

const M_PER_DEG_LAT = 111_320.0;

/**
 * Build the in-memory CSR graph from a parsed `.graph.json`. Projects all
 * coordinates to a local equirectangular metre grid centred on the dataset
 * (good to <0.1% at city scale, and a valid lower bound for the A* heuristic).
 */
export function buildGraph(raw: RawGraph): Graph {
  const nodeCount = raw.nodes.lon.length;
  const edgeCount = raw.edges.from.length;

  const lon = Float64Array.from(raw.nodes.lon);
  const lat = Float64Array.from(raw.nodes.lat);

  const [lon0, lat0] = raw.meta.center;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const project = (lo: number, la: number): [number, number] => [
    (lo - lon0) * mPerDegLon,
    (la - lat0) * M_PER_DEG_LAT,
  ];

  const mx = new Float64Array(nodeCount);
  const my = new Float64Array(nodeCount);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < nodeCount; i++) {
    const [x, y] = project(lon[i], lat[i]);
    mx[i] = x;
    my[i] = y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // --- Build CSR by counting out-degree, then a prefix sum, then a fill pass.
  const from = raw.edges.from;
  const rawTo = raw.edges.to;
  const head = new Int32Array(nodeCount + 1);
  for (let e = 0; e < edgeCount; e++) head[from[e] + 1]++;
  for (let v = 0; v < nodeCount; v++) head[v + 1] += head[v];

  const to = new Int32Array(edgeCount);
  const len_m = new Float64Array(edgeCount);
  const time_s = new Float64Array(edgeCount);
  const klass = new Uint8Array(edgeCount);
  const geom: (Float64Array | null)[] = new Array(edgeCount).fill(null);
  const rawGeom = raw.edges.geom;

  const cursor = Int32Array.from(head.subarray(0, nodeCount));
  for (let e = 0; e < edgeCount; e++) {
    const slot = cursor[from[e]]++;
    to[slot] = rawTo[e];
    len_m[slot] = raw.edges.len_m[e];
    time_s[slot] = raw.edges.time_s[e];
    klass[slot] = raw.edges.klass[e] as number;
    if (rawGeom && rawGeom[e]) {
      const pts = rawGeom[e];
      const flat = new Float64Array(pts.length * 2);
      for (let k = 0; k < pts.length; k++) {
        const [x, y] = project(pts[k][0], pts[k][1]);
        flat[2 * k] = x;
        flat[2 * k + 1] = y;
      }
      geom[slot] = flat;
    }
  }

  const features = projectFeatures(raw, project);

  // --- Reverse (transpose) CSR, for the backward half of bidirectional search.
  // rEdge[slot] maps back to the original forward edge id (for weight/geometry).
  const rhead = new Int32Array(nodeCount + 1);
  for (let e = 0; e < edgeCount; e++) rhead[to[e] + 1]++;
  for (let v = 0; v < nodeCount; v++) rhead[v + 1] += rhead[v];
  const rto = new Int32Array(edgeCount);
  const rEdge = new Int32Array(edgeCount);
  const rcursor = Int32Array.from(rhead.subarray(0, nodeCount));
  for (let u = 0; u < nodeCount; u++) {
    for (let e = head[u]; e < head[u + 1]; e++) {
      const t = to[e];
      const slot = rcursor[t]++;
      rto[slot] = u;
      rEdge[slot] = e;
    }
  }

  return {
    nodeCount,
    edgeCount,
    lon,
    lat,
    mx,
    my,
    head,
    to,
    len_m,
    time_s,
    klass,
    geom,
    rhead,
    rto,
    rEdge,
    meta: raw.meta,
    features,
    proj: { lon0, lat0, mPerDegLon, mPerDegLat: M_PER_DEG_LAT },
    bounds: { minX, minY, maxX, maxY },
  };
}

function projectFeatures(
  raw: RawGraph,
  project: (lo: number, la: number) => [number, number],
): ProjectedFeatures {
  const ring = (pts: [number, number][]): Float64Array => {
    const f = new Float64Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = project(pts[i][0], pts[i][1]);
      f[2 * i] = x;
      f[2 * i + 1] = y;
    }
    return f;
  };
  const feat = raw.features ?? {};
  return {
    water: (feat.water ?? []).map(ring),
    parks: (feat.parks ?? []).map(ring),
    rivers: (feat.rivers ?? []).map((r) => ({ pts: ring(r.pts), width_m: r.width_m })),
  };
}

/** Pick the weight array for a search (effective time includes traffic if set). */
export function weightArray(g: Graph, weight: "time" | "distance"): Float64Array {
  return weight === "time" ? g.effTime ?? g.time_s : g.len_m;
}

/**
 * Apply a simple traffic model: scale free-flow time by `1/speedFactor` (e.g.
 * 0.65 for congestion) and add `nodeDelaySec` per edge for intersections /
 * traffic lights. `speedFactor >= 1` with no delay clears it (free-flow).
 */
export function applyTraffic(g: Graph, speedFactor: number, nodeDelaySec: number): void {
  if (speedFactor >= 1 && nodeDelaySec <= 0) {
    g.effTime = undefined;
    return;
  }
  const eff = new Float64Array(g.edgeCount);
  for (let e = 0; e < g.edgeCount; e++) eff[e] = g.time_s[e] / speedFactor + nodeDelaySec;
  g.effTime = eff;
}

/** Fetch a graph file and build it. */
export async function loadGraph(url: string): Promise<Graph> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load graph: ${url} (${res.status})`);
  const raw = (await res.json()) as RawGraph;
  return buildGraph(raw);
}

/** Try each URL in order, returning the first that loads (real Munich, else sample). */
export async function loadGraphFirst(urls: string[]): Promise<Graph> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return buildGraph((await res.json()) as RawGraph);
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("no graph file could be loaded");
}
