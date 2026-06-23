// Core engine types. The whole app is "one shortest-path engine wrapped
// differently" — these types are the shared vocabulary every feature speaks.

/** Which edge attribute to minimise. */
export type Weight = "time" | "distance";

/** Road class ids — see GRAPH_FORMAT.md. */
export type RoadClass = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The on-disk `.graph.json` shape (parallel arrays). */
export interface RawGraph {
  meta: {
    name: string;
    directed: boolean;
    center: [number, number];
    bbox: [number, number, number, number];
    speeds_kmh: Record<string, number>;
    generated?: string;
    source: string;
    node_count: number;
    edge_count: number;
  };
  nodes: { lon: number[]; lat: number[] };
  edges: {
    from: number[];
    to: number[];
    len_m: number[];
    time_s: number[];
    klass: number[];
    geom: number[][][] | null;
  };
  features?: GraphFeatures;
}

/** Rendering-only polygons/polylines (never routed over). */
export interface GraphFeatures {
  water?: [number, number][][];
  parks?: [number, number][][];
  rivers?: { pts: [number, number][]; width_m: number }[];
}

/** Projected rendering features, in local-metre coordinates. */
export interface ProjectedFeatures {
  water: Float64Array[];
  parks: Float64Array[];
  rivers: { pts: Float64Array; width_m: number }[];
}

/**
 * In-memory graph. Topology is CSR (compressed sparse row): the out-edges of
 * node `v` are the slice `[head[v], head[v+1])` of the `to` / weight arrays.
 * Coordinates exist twice: geographic (lon/lat) and a local equirectangular
 * projection in metres (mx/my, north-positive) used for both rendering and the
 * A* heuristic.
 */
export interface Graph {
  nodeCount: number;
  edgeCount: number;

  lon: Float64Array;
  lat: Float64Array;
  mx: Float64Array; // local metres east of centre
  my: Float64Array; // local metres north of centre

  // CSR topology
  head: Int32Array; // length nodeCount + 1
  to: Int32Array; // length edgeCount
  len_m: Float64Array; // length edgeCount
  time_s: Float64Array; // length edgeCount
  klass: Uint8Array; // length edgeCount
  /** Projected polyline per edge ([x0,y0,x1,y1,...]) or null for a straight segment. */
  geom: (Float64Array | null)[];

  meta: RawGraph["meta"];
  features: ProjectedFeatures;
  /** Projection origin (lon/lat) and metres-per-degree, for screen<->world maths. */
  proj: { lon0: number; lat0: number; mPerDegLon: number; mPerDegLat: number };
  /** Projected bounds in metres. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Result of a single-source search. `order` is the visitation trace: the node
 * ids in the exact sequence they were settled. The animation scrubber is just
 * an index into this array — nothing re-runs the algorithm to draw frames.
 */
export interface SearchResult {
  /** Best cost from source to each node (Infinity = unreached / pruned). */
  dist: Float64Array;
  /** Predecessor node on the best path (-1 = none). */
  prev: Int32Array;
  /** Edge index used to reach each node (-1 = none) — for drawing geometry. */
  prevEdge: Int32Array;
  /** Settle order (the trace). Length = settledCount. */
  order: Int32Array;
  settledCount: number;
  /** Whether `target` (if given) was reached. */
  found: boolean;
  target: number;
}

/** Options shared by every single-source search. */
export interface SearchOptions {
  weight?: Weight;
  /** Stop as soon as this node is settled (point-to-point). */
  target?: number;
  /** Bounded search: never expand past this cost (isochrones). */
  maxCost?: number;
}
