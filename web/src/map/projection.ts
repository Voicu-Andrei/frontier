import type { Graph } from "../engine/types";

/**
 * Maps world metres <-> screen pixels. Built by fitting the graph bounds into
 * the viewport, then adjustable with zoom + pan for interaction. World north is
 * +y, so screen y is flipped.
 */
export class Viewport {
  width = 1;
  height = 1;
  baseScale = 1;
  cx = 0;
  cy = 0;
  zoom = 1;
  panX = 0;
  panY = 0;

  fit(g: Graph, width: number, height: number, pad = 0.06): void {
    this.width = width;
    this.height = height;
    const b = g.bounds;
    this.cx = (b.minX + b.maxX) / 2;
    this.cy = (b.minY + b.maxY) / 2;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const sx = (width * (1 - pad)) / w;
    const sy = (height * (1 - pad)) / h;
    this.baseScale = Math.min(sx, sy);
  }

  get scale(): number {
    return this.baseScale * this.zoom;
  }

  toScreenX(wx: number): number {
    return (wx - this.cx) * this.scale + this.width / 2 + this.panX;
  }
  toScreenY(wy: number): number {
    return -(wy - this.cy) * this.scale + this.height / 2 + this.panY;
  }
  toWorldX(px: number): number {
    return (px - this.width / 2 - this.panX) / this.scale + this.cx;
  }
  toWorldY(py: number): number {
    return -(py - this.height / 2 - this.panY) / this.scale + this.cy;
  }

  /** Zoom toward a screen anchor so the point under the cursor stays put. */
  zoomAt(px: number, py: number, factor: number): void {
    const wx = this.toWorldX(px);
    const wy = this.toWorldY(py);
    this.zoom = Math.max(0.5, Math.min(14, this.zoom * factor));
    this.panX += px - this.toScreenX(wx);
    this.panY += py - this.toScreenY(wy);
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }
}
