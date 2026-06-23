import type { Graph } from "./types";

interface KDNode {
  id: number;
  axis: 0 | 1;
  left: KDNode | null;
  right: KDNode | null;
}

/**
 * Static 2D k-d tree over node coordinates, for snapping a clicked map point to
 * the nearest graph node. Built once per graph; queries are O(log n) on
 * average. This is the spatial index from the DS&A inventory.
 */
export class KDTree {
  private root: KDNode | null;
  private xs: Float64Array;
  private ys: Float64Array;

  constructor(g: Graph) {
    this.xs = g.mx;
    this.ys = g.my;
    const ids = Array.from({ length: g.nodeCount }, (_, i) => i);
    this.root = this.build(ids, 0);
  }

  private build(ids: number[], depth: number): KDNode | null {
    if (ids.length === 0) return null;
    const axis: 0 | 1 = (depth & 1) as 0 | 1;
    const coord = axis === 0 ? this.xs : this.ys;
    ids.sort((a, b) => coord[a] - coord[b]);
    const mid = ids.length >> 1;
    return {
      id: ids[mid],
      axis,
      left: this.build(ids.slice(0, mid), depth + 1),
      right: this.build(ids.slice(mid + 1), depth + 1),
    };
  }

  /** Nearest node id to a projected point (metres). */
  nearest(x: number, y: number): number {
    let bestId = -1;
    let bestD2 = Infinity;
    const { xs, ys } = this;

    const visit = (node: KDNode | null): void => {
      if (!node) return;
      const dx = x - xs[node.id];
      const dy = y - ys[node.id];
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestId = node.id;
      }
      const diff = node.axis === 0 ? x - xs[node.id] : y - ys[node.id];
      const near = diff < 0 ? node.left : node.right;
      const far = diff < 0 ? node.right : node.left;
      visit(near);
      // only descend the far side if the splitting plane is within best radius
      if (diff * diff < bestD2) visit(far);
    };

    visit(this.root);
    return bestId;
  }
}
