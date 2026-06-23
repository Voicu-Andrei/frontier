// Graph files the app tries, in order. Real Munich first (produced by
// pipeline/fetch_munich.py), then the committed synthetic sample as a fallback,
// so the app works out of the box and upgrades itself once real data exists.
export const GRAPH_URLS = [
  `${import.meta.env.BASE_URL}data/munich.graph.json`,
  `${import.meta.env.BASE_URL}data/munich-sample.graph.json`,
];

/** Default seconds for a full frontier-expansion animation sweep (user-adjustable). */
export const DEFAULT_SWEEP_SECONDS = 8;

/** Animation speed presets (seconds per sweep); lower = faster. */
export const SPEED_PRESETS: { label: string; sec: number }[] = [
  { label: "0.25×", sec: 24 },
  { label: "0.5×", sec: 16 },
  { label: "1×", sec: 8 },
  { label: "2×", sec: 4 },
  { label: "4×", sec: 2 },
];
