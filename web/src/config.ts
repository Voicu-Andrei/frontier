// Which graph file the app loads. Swap to "munich.graph.json" after running the
// real OSM pipeline (see pipeline/README.md) — nothing else needs to change.
export const GRAPH_URL = `${import.meta.env.BASE_URL}data/munich-sample.graph.json`;

/** Seconds for a full frontier-expansion animation sweep, per mode. */
export const SWEEP_SECONDS = 8;
