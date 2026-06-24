// Graph files the app tries, in order. Real Munich first (produced by
// pipeline/fetch_munich.py), then the committed synthetic sample as a fallback,
// so the app works out of the box and upgrades itself once real data exists.
export const GRAPH_URLS = [
  `${import.meta.env.BASE_URL}data/munich.graph.json`,
  `${import.meta.env.BASE_URL}data/munich-sample.graph.json`,
];

// The animation advances at a constant NODES-PER-SECOND rate, so a short query
// finishes quickly and a long one takes longer (the bar fills to match the real
// work), instead of every query taking the same wall-clock time.
export const DEFAULT_STEPS_PER_SEC = 360;

/** Animation speed presets, in settled-nodes per second. */
export const SPEED_PRESETS: { label: string; steps: number }[] = [
  { label: "0.25×", steps: 90 },
  { label: "0.5×", steps: 180 },
  { label: "1×", steps: 360 },
  { label: "2×", steps: 720 },
  { label: "4×", steps: 1440 },
];

/** "Typical traffic" model: congestion speed factor + per-intersection delay. */
export const TRAFFIC_FACTOR = 0.62;
export const TRAFFIC_NODE_DELAY_S = 6;
