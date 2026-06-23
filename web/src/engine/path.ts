import type { Graph, SearchResult } from "./types";

export interface Path {
  /** Node ids from source to target. */
  nodes: number[];
  /** Edge indices, one per hop (edge i connects nodes[i] -> nodes[i+1]). */
  edges: number[];
}

export interface PathStats {
  distance_m: number;
  time_s: number;
  /** Number of significant direction changes along the route. */
  turns: number;
}

const TURN_THRESHOLD_RAD = (35 * Math.PI) / 180;

/** Walk predecessors from `target` back to the search source. */
export function reconstructPath(result: SearchResult, source: number, target: number): Path | null {
  if (target !== source && result.prev[target] === -1) return null; // unreached
  const nodes: number[] = [];
  const edges: number[] = [];
  let cur = target;
  while (cur !== -1 && cur !== source) {
    nodes.push(cur);
    edges.push(result.prevEdge[cur]);
    cur = result.prev[cur];
  }
  if (cur !== source) return null;
  nodes.push(source);
  nodes.reverse();
  edges.reverse();
  return { nodes, edges };
}

/**
 * Build the projected polyline for a path, following each edge's real geometry
 * (shape points) where present and falling back to straight node-to-node
 * segments otherwise. Returns a flat [x0,y0,x1,y1,...] array in metres.
 */
export function pathPolyline(g: Graph, path: Path): Float64Array {
  const out: number[] = [];
  if (path.nodes.length === 0) return new Float64Array(0);
  out.push(g.mx[path.nodes[0]], g.my[path.nodes[0]]);
  for (let i = 0; i < path.edges.length; i++) {
    const e = path.edges[i];
    const geo = e >= 0 ? g.geom[e] : null;
    if (geo) {
      // append all but the first point (which coincides with the current tail)
      for (let k = 2; k < geo.length; k += 2) out.push(geo[k], geo[k + 1]);
    } else {
      const v = path.nodes[i + 1];
      out.push(g.mx[v], g.my[v]);
    }
  }
  return Float64Array.from(out);
}

/** Distance, travel time, and turn count for a path. */
export function pathStats(g: Graph, path: Path): PathStats {
  let distance_m = 0;
  let time_s = 0;
  for (const e of path.edges) {
    if (e < 0) continue;
    distance_m += g.len_m[e];
    time_s += g.time_s[e];
  }

  // Turns: angle between consecutive node-to-node chords at each interior node.
  let turns = 0;
  const { mx, my } = g;
  const ns = path.nodes;
  for (let i = 1; i < ns.length - 1; i++) {
    const ax = mx[ns[i]] - mx[ns[i - 1]];
    const ay = my[ns[i]] - my[ns[i - 1]];
    const bx = mx[ns[i + 1]] - mx[ns[i]];
    const by = my[ns[i + 1]] - my[ns[i]];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-6 || lb < 1e-6) continue;
    const cos = (ax * bx + ay * by) / (la * lb);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > TURN_THRESHOLD_RAD) turns++;
  }
  return { distance_m, time_s, turns };
}
