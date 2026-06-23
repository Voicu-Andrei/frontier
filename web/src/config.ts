// Graph files the app tries, in order. Real Munich first (produced by
// pipeline/fetch_munich.py), then the committed synthetic sample as a fallback,
// so the app works out of the box and upgrades itself once real data exists.
export const GRAPH_URLS = [
  `${import.meta.env.BASE_URL}data/munich.graph.json`,
  `${import.meta.env.BASE_URL}data/munich-sample.graph.json`,
];

/** Seconds for a full frontier-expansion animation sweep, per mode. */
export const SWEEP_SECONDS = 8;
