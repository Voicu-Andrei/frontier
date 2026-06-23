# RouteLab pipeline (offline data prep)

Python turns map data into a compact graph file the browser app loads. The
**routing algorithms are not here** — they live in `web/src/engine` and are
written from scratch. This stage only *parses and shapes data*, which is exactly
what third-party OSM libraries are for.

Output of every script conforms to [`../GRAPH_FORMAT.md`](../GRAPH_FORMAT.md).

## Two ways to get a graph

### 1. Synthetic (no dependencies, runs anywhere) — already committed

```bash
python3 generate_synthetic.py        # writes web/public/data/munich-sample.graph.json
```

A city-like graph with real lon/lat, metre lengths, and road-class speeds around
Munich's centre. Real in every algorithmic sense; just not Munich's actual
streets. This is what the app ships with so it runs out of the box.

### 2. Real Munich from OpenStreetMap (run locally)

The build sandbox blocks Geofabrik/Overpass, so do this on your own machine.

```bash
pip install -r requirements.txt

mkdir -p data
curl -L -o data/oberbayern.osm.pbf \
  https://download.geofabrik.de/europe/germany/oberbayern-latest.osm.pbf

# parse -> build -> export, clipped to roughly Munich
python3 export.py data/oberbayern.osm.pbf \
  --bbox 11.40 48.05 11.75 48.25 \
  --out ../web/public/data/munich.graph.json
```

Then either overwrite `munich-sample.graph.json`, or set `GRAPH_URL` in
`web/src/config.ts` to `munich.graph.json`. Nothing else changes — the engine and
UI consume the same format.

Tip: start with a **tight bbox** (inside the Mittlerer Ring) for fast iteration,
then widen it once everything works. Smaller graph = snappier queries and faster
(future) contraction-hierarchy preprocessing.

## Files

| file | role |
|------|------|
| `generate_synthetic.py` | procedural city graph (stdlib only) |
| `parse_osm.py`          | `.osm.pbf` → drivable network + water/parks (pyrosm) |
| `build_graph.py`        | network → weighted graph, largest connected component |
| `export.py`             | orchestrates parse→build→write `.graph.json` |
| `contraction.py`        | *(planned)* contraction-hierarchy shortcuts |
