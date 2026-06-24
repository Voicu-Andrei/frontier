/**
 * Preview generator (not a real test). Renders the actual basemap + overlay
 * pipeline against the real graph via @napi-rs/canvas and writes PNGs, so the
 * visuals can be eyeballed without a browser. Skipped unless RENDER_PREVIEWS=1.
 *
 *   RENDER_PREVIEWS=1 OUT=/abs/dir npx vitest run src/map/__tests__/preview.test.ts
 */
import { describe, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildGraph } from "../../engine/graph";
import { KDTree } from "../../engine/kdtree";
import { buildScene, type Mode, type SceneParams } from "../../state/scene";
import { Viewport } from "../projection";
import { renderBase, renderOverlay } from "../render";
import type { Palette } from "../../theme/themes";
import type { RawGraph } from "../../engine/types";

const PALETTES: Record<string, Palette> = {
  carbon: p("#121821", "#1b4f70", "#1c4a2c", "#222c39", "#3a4757", "#232d3a", "#2b8bff", "#1ff0d6", "#05070b", "rgba(124,92,255,0.20)", "rgba(236,72,153,0.92)", "rgba(250,204,21,1)", "#22c55e", "#fb5246", "#2b8bff", "#061018", "#2b8bff", "#a78bfa", "#eef2f7", "#5c6677", "rgba(255,255,255,0.10)"),
  paper: p("#e4e0d6", "#aaccea", "#cbe0bd", "#c2bcab", "#ffffff", "#f1ede3", "#1a73e8", "#00c2d6", "#ffffff", "rgba(123,58,237,0.30)", "rgba(214,64,159,0.92)", "rgba(245,135,12,1)", "#16a34a", "#ea4335", "#1a73e8", "#ffffff", "#1a73e8", "#9333ea", "#1b1d22", "#9aa0aa", "rgba(20,22,28,0.10)"),
  blueprint: p("#0f1830", "#163a66", "#15506a", "#1b2c4c", "#44619c", "#25395f", "#22d3ee", "#38bdf8", "#070c18", "rgba(56,189,248,0.16)", "rgba(244,114,182,0.92)", "rgba(250,204,21,1)", "#34d399", "#fb7185", "#22d3ee", "#06121f", "#22d3ee", "#f472b6", "#eaf0ff", "#5e6e96", "rgba(120,160,255,0.16)"),
};

function p(mapLand: string, mapWater: string, mapPark: string, roadCasing: string, road: string, roadMinor: string, routeA: string, routeB: string, routeCasing: string, frontierSettle: string, frontierWave1: string, frontierWave2: string, start: string, end: string, accent: string, accentInk: string, algoA: string, algoB: string, ink: string, inkFaint: string, hairline: string): Palette {
  return { bg: mapLand, mapLand, mapWater, mapPark, roadCasing, road, roadMinor, routeA, routeB, routeCasing, frontierSettle, frontierWave1, frontierWave2, start, end, accent, accentInk, algoA, algoB, ink, inkFaint, hairline };
}

function loadGraph() {
  const url = new URL("../../../public/data/munich-sample.graph.json", import.meta.url);
  return buildGraph(JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as RawGraph);
}

function paramsFor(g: ReturnType<typeof loadGraph>, kd: KDTree, mode: Mode): SceneParams {
  const b = g.bounds;
  const pk = (fx: number, fy: number) => kd.nearest(b.minX + fx * (b.maxX - b.minX), b.minY + fy * (b.maxY - b.minY));
  return {
    mode, weight: "time",
    source: pk(0.2, 0.22), target: pk(0.82, 0.84), isoBudgetMin: 8, cutBudgetMin: 4,
    stops: [pk(0.2, 0.25), pk(0.52, 0.72), pk(0.8, 0.6), pk(0.66, 0.3), pk(0.36, 0.52)],
    units: [pk(0.2, 0.72), pk(0.76, 0.76), pk(0.8, 0.24), pk(0.26, 0.26)],
    jobs: [pk(0.5, 0.56), pk(0.62, 0.4), pk(0.4, 0.7), pk(0.7, 0.62)],
  };
}

describe.skipIf(!process.env.RENDER_PREVIEWS)("render previews", () => {
  const g = loadGraph();
  const kd = new KDTree(g);
  const outDir = process.env.OUT || "/tmp/routelab-previews";
  mkdirSync(outDir, { recursive: true });

  const shots: [string, Mode, keyof typeof PALETTES, number][] = [
    ["p2p-carbon", "p2p", "carbon", 0.62],
    ["bidir-meet", "bidir", "carbon", 0.6],
    ["bidir-drive", "bidir", "carbon", 0.85],
    ["alt-carbon", "alt", "carbon", 1.0],
    ["iso-carbon", "iso", "carbon", 1.0],
    ["race-blueprint", "race", "blueprint", 0.5],
    ["dispatch-carbon", "dispatch", "carbon", 1.0],
    ["cut-carbon", "cut", "carbon", 1.0],
    ["multi-paper", "multi", "paper", 0.95],
    ["p2p-paper", "p2p", "paper", 0.62],
  ];

  for (const [name, mode, themeKey, progress] of shots) {
    it(`renders ${name}`, async () => {
      const { createCanvas } = await import("@napi-rs/canvas");
      const W = 1180, H = 720;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      const palette = PALETTES[themeKey];
      const scene = buildScene(g, paramsFor(g, kd, mode));
      const panes = mode === "race" ? 2 : 1;
      for (let i = 0; i < panes; i++) {
        const pw = W / panes;
        const vp = new Viewport();
        vp.fit(g, pw, H);
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * pw, 0, pw, H);
        ctx.clip();
        ctx.translate(i * pw, 0);
        renderBase(ctx, g, palette, vp);
        renderOverlay(ctx, g, palette, vp, scene, i, progress, 800);
        ctx.restore();
      }
      writeFileSync(`${outDir}/${name}.png`, canvas.toBuffer("image/png"));
    });
  }
});
