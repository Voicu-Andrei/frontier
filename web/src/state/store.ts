import { create } from "zustand";
import type { Graph, Weight } from "../engine/types";
import { loadGraphFirst } from "../engine/graph";
import { KDTree } from "../engine/kdtree";
import { buildScene, type Mode, type Scene, type SceneParams } from "./scene";
import type { ThemeId } from "../theme/themes";

interface State {
  status: "loading" | "ready" | "error";
  error?: string;
  graph: Graph | null;
  kdtree: KDTree | null;

  theme: ThemeId;
  mode: Mode;
  weight: Weight;

  params: SceneParams;
  scene: Scene | null;

  progress: number;
  playing: boolean;
  nextClick: "start" | "end";
  tokensOpen: boolean;

  load: (urls: string[]) => Promise<void>;
  setTheme: (t: ThemeId) => void;
  setMode: (m: Mode) => void;
  setWeight: (w: Weight) => void;
  setProgress: (p: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  toggleTokens: () => void;
  setIsoBudget: (min: number) => void;
  mapClick: (worldX: number, worldY: number) => void;
}

/** Pick the graph node nearest a fractional position within the bounds. */
function pick(g: Graph, kd: KDTree, fx: number, fy: number): number {
  const b = g.bounds;
  return kd.nearest(b.minX + fx * (b.maxX - b.minX), b.minY + fy * (b.maxY - b.minY));
}

function defaultParams(g: Graph, kd: KDTree, mode: Mode, weight: Weight): SceneParams {
  return {
    mode,
    weight,
    source: pick(g, kd, 0.2, 0.22),
    target: pick(g, kd, 0.82, 0.84),
    isoBudgetMin: 5,
    stops: [
      pick(g, kd, 0.2, 0.25),
      pick(g, kd, 0.52, 0.72),
      pick(g, kd, 0.8, 0.6),
      pick(g, kd, 0.66, 0.3),
      pick(g, kd, 0.36, 0.52),
    ],
    units: [pick(g, kd, 0.2, 0.72), pick(g, kd, 0.76, 0.76), pick(g, kd, 0.8, 0.24), pick(g, kd, 0.26, 0.26)],
    jobs: [pick(g, kd, 0.5, 0.56), pick(g, kd, 0.62, 0.4), pick(g, kd, 0.4, 0.7), pick(g, kd, 0.7, 0.62)],
  };
}

export const useStore = create<State>((set, get) => ({
  status: "loading",
  graph: null,
  kdtree: null,
  theme: "carbon",
  mode: "p2p",
  weight: "time",
  params: {
    mode: "p2p",
    weight: "time",
    source: 0,
    target: 0,
    isoBudgetMin: 8,
    stops: [],
    units: [],
    jobs: [],
  },
  scene: null,
  progress: 0,
  playing: true,
  nextClick: "start",
  tokensOpen: false,

  async load(urls) {
    try {
      const graph = await loadGraphFirst(urls);
      const kdtree = new KDTree(graph);
      const params = defaultParams(graph, kdtree, get().mode, get().weight);
      set({ status: "ready", graph, kdtree, params, scene: buildScene(graph, params), progress: 0, playing: true });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  setTheme: (theme) => set({ theme }),

  setMode(mode) {
    const { graph, params } = get();
    if (!graph) return set({ mode });
    const next = { ...params, mode };
    set({ mode, params: next, scene: buildScene(graph, next), progress: 0, playing: true });
  },

  setWeight(weight) {
    const { graph, params } = get();
    if (!graph) return set({ weight });
    const next = { ...params, weight };
    set({ weight, params: next, scene: buildScene(graph, next), progress: 0, playing: true });
  },

  setProgress: (progress) => set({ progress }),
  setPlaying: (playing) => set({ playing }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  toggleTokens: () => set((s) => ({ tokensOpen: !s.tokensOpen })),

  setIsoBudget(minutes) {
    const { graph, params } = get();
    if (!graph) return;
    const next = { ...params, isoBudgetMin: minutes };
    set({ params: next, scene: buildScene(graph, next), progress: 0, playing: true });
  },

  mapClick(worldX, worldY) {
    const { graph, kdtree, params, mode, nextClick } = get();
    if (!graph || !kdtree) return;
    const node = kdtree.nearest(worldX, worldY);
    let next = { ...params };
    let flip = nextClick;
    if (mode === "p2p" || mode === "race") {
      if (nextClick === "start") {
        next.source = node;
        flip = "end";
      } else {
        next.target = node;
        flip = "start";
      }
    } else if (mode === "iso") {
      next.source = node;
    } else if (mode === "multi") {
      next = { ...params, stops: [node, ...params.stops.slice(1)] };
    } else if (mode === "dispatch") {
      next = { ...params, jobs: [node, ...params.jobs.slice(1)] };
    }
    if (next.source === next.target) return; // ignore degenerate
    set({ params: next, scene: buildScene(graph, next), progress: 0, playing: true, nextClick: flip });
  },
}));
