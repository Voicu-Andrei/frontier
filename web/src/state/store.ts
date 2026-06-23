import { create } from "zustand";
import type { Graph, Weight } from "../engine/types";
import { loadGraphFirst } from "../engine/graph";
import { KDTree } from "../engine/kdtree";
import { buildScene, type Mode, type Scene, type SceneParams } from "./scene";
import type { ThemeId } from "../theme/themes";
import { DEFAULT_SWEEP_SECONDS } from "../config";

export type Placing = "unit" | "call";

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
  speedSec: number; // seconds for a full animation sweep (lower = faster)
  nextClick: "start" | "end";
  placing: Placing; // dispatch: what a click drops
  infoOpen: boolean;

  load: (urls: string[]) => Promise<void>;
  setTheme: (t: ThemeId) => void;
  setMode: (m: Mode) => void;
  setWeight: (w: Weight) => void;
  setProgress: (p: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  setSpeed: (sec: number) => void;
  toggleInfo: () => void;
  setIsoBudget: (min: number) => void;
  setPlacing: (p: Placing) => void;
  mapClick: (worldX: number, worldY: number) => void;
  multiUndo: () => void;
  multiClear: () => void;
  dispatchClear: (which: "units" | "calls") => void;
}

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
    isoBudgetMin: 8,
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

export const useStore = create<State>((set, get) => {
  // Commit a new params object: rebuild the scene and set mode-aware playback.
  // Isochrone is a static answer, so it shows fully and doesn't auto-play.
  const commit = (next: SceneParams, extra: Partial<State> = {}) => {
    const { graph } = get();
    if (!graph) return set({ params: next, ...extra });
    const isStatic = next.mode === "iso";
    set({
      params: next,
      scene: buildScene(graph, next),
      progress: isStatic ? 1 : 0,
      playing: !isStatic,
      ...extra,
    });
  };

  return {
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
      isoBudgetMin: 5,
      stops: [],
      units: [],
      jobs: [],
    },
    scene: null,
    progress: 0,
    playing: true,
    speedSec: DEFAULT_SWEEP_SECONDS,
    nextClick: "start",
    placing: "call",
    infoOpen: false,

    async load(urls) {
      try {
        const graph = await loadGraphFirst(urls);
        const kdtree = new KDTree(graph);
        const params = defaultParams(graph, kdtree, get().mode, get().weight);
        set({ status: "ready", graph, kdtree });
        commit(params);
      } catch (e) {
        set({ status: "error", error: String(e) });
      }
    },

    setTheme: (theme) => set({ theme }),
    setMode(mode) {
      const next = { ...get().params, mode };
      set({ mode });
      commit(next);
    },
    setWeight(weight) {
      const next = { ...get().params, weight };
      set({ weight });
      commit(next);
    },
    setProgress: (progress) => set({ progress }),
    setPlaying: (playing) => set({ playing }),
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    setSpeed: (speedSec) => set({ speedSec }),
    toggleInfo: () => set((s) => ({ infoOpen: !s.infoOpen })),

    setIsoBudget(minutes) {
      commit({ ...get().params, isoBudgetMin: minutes });
    },
    setPlacing: (placing) => set({ placing }),

    mapClick(worldX, worldY) {
      const { graph, kdtree, params, mode, nextClick, placing } = get();
      if (!graph || !kdtree) return;
      const node = kdtree.nearest(worldX, worldY);
      if (mode === "p2p" || mode === "race" || mode === "bidir" || mode === "alt") {
        if (nextClick === "start") {
          if (node === params.target) return;
          commit({ ...params, source: node }, { nextClick: "end" });
        } else {
          if (node === params.source) return;
          commit({ ...params, target: node }, { nextClick: "start" });
        }
      } else if (mode === "iso") {
        commit({ ...params, source: node });
      } else if (mode === "multi") {
        if (params.stops.length >= 9) return;
        commit({ ...params, stops: [...params.stops, node] });
      } else if (mode === "dispatch") {
        if (placing === "unit") commit({ ...params, units: [...params.units, node] });
        else commit({ ...params, jobs: [...params.jobs, node] });
      }
    },

    multiUndo() {
      const { params } = get();
      commit({ ...params, stops: params.stops.slice(0, -1) });
    },
    multiClear() {
      commit({ ...get().params, stops: [] });
    },
    dispatchClear(which) {
      const { params } = get();
      commit(which === "units" ? { ...params, units: [] } : { ...params, jobs: [] });
    },
  };
});
