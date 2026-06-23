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

### 2. Real Munich from OpenStreetMap — the easy way (recommended)

**Zero dependencies, one command.** `fetch_munich.py` queries Overpass and writes
the graph directly — no `pip install`, no PBF download, stdlib only. Run it on any
machine with internet (the build sandbox blocks Overpass, so not there):

```bash
python3 fetch_munich.py                    # central Munich (inside the Mittlerer Ring)
python3 fetch_munich.py --bbox 48.06 11.36 48.22 11.72   # the whole city (bigger)
```

It writes `web/public/data/munich.graph.json`. **The app prefers that file over
the synthetic sample automatically** — just refresh the browser and you're on the
real Munich street network.

### 3. Real Munich via a Geofabrik extract (heavier, needs deps)

If you'd rather work from a full `.osm.pbf` extract (e.g. for a very large area):

```bash
pip install -r requirements.txt
mkdir -p data
curl -L -o data/oberbayern.osm.pbf \
  https://download.geofabrik.de/europe/germany/oberbayern-latest.osm.pbf
python3 export.py data/oberbayern.osm.pbf \
  --bbox 11.40 48.05 11.75 48.25 \
  --out ../web/public/data/munich.graph.json
```

Both real paths emit the same format the engine and UI already consume — nothing
in the app changes.

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
