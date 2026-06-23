# RouteLab

A web-based **shortest-path command center** built as a university capstone for
an Algorithms & Data Structures course. One routing engine — written from
scratch — wrapped into several live, animated features over a real city graph.

> **Core idea:** every feature is the *same* shortest-path engine with a
> different stopping rule or post-processing step. Build one solid core (graph +
> priority queue + search), and routing, racing, isochrones, dispatch and
> multi-stop all fall out as thin layers.

## What works today

| Mode | What it shows | Algorithm |
|------|---------------|-----------|
| **Point** | click two points → on-road route with distance / ETA / turns | A* |
| **Race** | split screen, same query, Dijkstra vs A* frontier + node counts | both, benchmarked |
| **Iso** | reachable area within a time budget — bands grow along fast roads | bounded Dijkstra + reach hull |
| **Multi** | order several stops and route through them | nearest-neighbour TSP over A* |
| **Dispatch** | which unit reaches each call first | multi-source Dijkstra |

Plus: 3 fully tokenised themes (Paper / Carbon / Blueprint — reskin = one CSS
block), a live token inspector, a timeline scrubber that replays the search
frontier step by step, wheel-zoom / drag-pan, and a self-rendered vector map (no
tiles) so routes are always *on the road* and the whole map reskins per theme.

## Architecture

```
pipeline/         Python — offline data prep (runs once, off the hot path)
  generate_synthetic.py   procedural Munich-area graph (stdlib only, committed sample)
  parse_osm.py            real OSM .pbf -> drivable network (pyrosm)
  build_graph.py          network -> weighted graph, largest component
  export.py               parse -> build -> write .graph.json
web/              TypeScript + React — all live queries + animation in-browser
  src/engine/     the capstone: graph (CSR), binary heap, k-d tree, Dijkstra,
                  A*, isochrone, multi-source, multi-stop  + a full test suite
  src/map/        self-rendered canvas basemap + animated frontier/route overlay
  src/ui/         top bar, HUD, scrubber, race chart, token inspector
  src/state/      zustand store + per-mode scene builder
GRAPH_FORMAT.md   the contract between the pipeline and the app
```

The routing algorithms are **implemented from scratch** — third-party libraries
are used only for *parsing* OSM, never for the shortest-path logic.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

The app ships with a committed synthetic Munich-area graph, so it runs with no
data setup. Tests and benchmarks:

```bash
npm test             # engine correctness + empirical benchmark
RENDER_PREVIEWS=1 OUT=/tmp/shots npm test -- src/map/__tests__/preview.test.ts
```

### Real Munich data

The build environment blocks OSM downloads, so the real graph is produced
locally — see [`pipeline/README.md`](pipeline/README.md). Output matches
`GRAPH_FORMAT.md`, so swapping it in needs no app changes.

## DS&A inventory

- **Data structures:** binary min-heap with decrease-key; CSR adjacency graph;
  2-D k-d tree (spatial snap); hash/typed-array maps.
- **Algorithms:** BFS/DFS baseline, Dijkstra, A* (admissible Euclidean/time
  heuristic), bounded single-source search (isochrone), multi-source Dijkstra,
  nearest-neighbour TSP. *Planned:* bidirectional search, contraction
  hierarchies / ALT landmarks, Held-Karp, Yen's k-shortest, max-flow min-cut.
- **Analysis:** theoretical big-O per algorithm + empirical benchmarking (nodes
  settled, wall-clock) surfaced in `bench.test.ts` and live in Race mode.

## Correctness

- A* and bounded search are cross-checked against plain Dijkstra: costs must
  match the optimum (40 random pairs, both weightings) — see
  `engine/__tests__/astar.test.ts`.
- Each structure (heap, k-d tree) is unit-tested against a brute-force oracle.
- The two-wrapper engine design keeps benchmark timing free of any
  animation/trace overhead.

## Status

Tier 1 (point-to-point) and Tier 2 (race/benchmark) are complete; Tier 3
features (isochrone, multi-stop, dispatch) are in as working first cuts.
Bidirectional search, contraction hierarchies, and the showstopper max-flow
containment are the next rungs.
