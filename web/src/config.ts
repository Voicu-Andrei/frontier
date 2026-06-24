// Graph files the app tries, in order. Real Munich first (produced by
// pipeline/fetch_munich.py), then the committed synthetic sample as a fallback,
// so the app works out of the box and upgrades itself once real data exists.
export const GRAPH_URLS = [
  `${import.meta.env.BASE_URL}data/munich.graph.json`,
  `${import.meta.env.BASE_URL}data/munich-sample.graph.json`,
];

// Animation pacing: the sweep duration scales with how much the search explored,
// but is CLAMPED to a sensible band so a tiny query isn't a blink and a huge one
// (e.g. dispatch flooding the whole city) doesn't drag. The speed pills then
// scale that whole band.
export const DEFAULT_SPEED = 1; // multiplier
export const ANIM_REF_STEPS_PER_SEC = 900; // pace before clamping
export const ANIM_MIN_SEC = 1.1; // floor so short queries are watchable
export const ANIM_MAX_SEC = 5.5; // ceiling so big searches don't drag

/** Animation speed multipliers. */
export const SPEED_PRESETS: { label: string; mult: number }[] = [
  { label: "0.5×", mult: 0.5 },
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
  { label: "8×", mult: 8 },
];

/** "Typical traffic" model: congestion speed factor + per-intersection delay. */
export const TRAFFIC_FACTOR = 0.62;
export const TRAFFIC_NODE_DELAY_S = 6;
