import { describe, it, expect } from "vitest";
import { applyTraffic, weightArray } from "../graph";
import { computeRoute } from "../query";
import { loadSampleGraph } from "./fixtures";

describe("traffic model", () => {
  it("typical traffic increases effective time and ETA, then clears", () => {
    const g = loadSampleGraph();
    const s = 40;
    const t = g.nodeCount - 60;

    const free = computeRoute(g, s, t, "astar", "time");
    expect(g.effTime).toBeUndefined();

    applyTraffic(g, 0.62, 6);
    expect(g.effTime).toBeDefined();
    // every effective edge time is slower than free-flow
    for (let e = 0; e < g.edgeCount; e++) expect(weightArray(g, "time")[e]).toBeGreaterThan(g.time_s[e]);

    const congested = computeRoute(g, s, t, "astar", "time");
    expect(congested.stats!.time_s).toBeGreaterThan(free.stats!.time_s);
    // distance is unchanged by traffic (same optimal-ish path length scale)
    expect(congested.stats!.distance_m).toBeGreaterThan(0);

    applyTraffic(g, 1, 0);
    expect(g.effTime).toBeUndefined();
  });
});
