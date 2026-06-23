# RouteLab graph format (`.graph.json`)

The single contract between the **Python pipeline** (offline data prep) and the
**TypeScript engine** (live queries in the browser). Anything that produces a
file in this shape — the real OSM pipeline or the synthetic generator — can be
loaded by the app with no code changes.

Coordinates are WGS84 (`EPSG:4326`, lon/lat degrees). The app projects to Web
Mercator for rendering. Parallel arrays are used everywhere: a node or edge is
identified by its index into these arrays. This keeps the file compact and maps
directly onto typed arrays (`Int32Array` / `Float64Array`) in the engine.

```jsonc
{
  "meta": {
    "name": "munich-synthetic",     // dataset id
    "directed": true,               // edges are one-way as listed (two-way roads emit both directions)
    "center": [11.5755, 48.1372],   // [lon, lat] for the initial view
    "bbox": [minLon, minLat, maxLon, maxLat],
    "speeds_kmh": { "motorway": 100, "primary": 60, ... },  // informational
    "generated": "2026-06-23T00:00:00Z",
    "source": "synthetic" | "osm"
  },

  "nodes": {
    "lon": [11.57, 11.58, ...],     // length = nodeCount
    "lat": [48.13, 48.14, ...]      // length = nodeCount
  },

  "edges": {
    "from":  [0, 0, 1, ...],        // source node index   (length = edgeCount)
    "to":    [1, 2, 0, ...],        // target node index
    "len_m": [83.4, 120.0, ...],    // edge length in metres        (weight: distance)
    "time_s":[5.0, 7.2, ...],       // free-flow travel time, seconds (weight: time)
    "klass": [3, 5, 5, ...],        // road class id (see below) — drives render width + speed
    "geom":  null | [[[lon,lat],...], ...]  // OPTIONAL per-edge polyline shape.
                                            // null/absent => straight segment from->to.
                                            // OSM exports include shape points; synthetic omits.
  },

  // OPTIONAL — rendering only, never routed over. Lets the self-rendered
  // basemap show water and green space so it reskins fully with the themes.
  "features": {
    "water":  [ [[lon,lat], ...], ... ],            // closed polygons (lakes)
    "parks":  [ [[lon,lat], ...], ... ],            // closed polygons
    "rivers": [ { "pts": [[lon,lat], ...], "width_m": 40 }, ... ]
  }
}
```

## Road classes (`klass`)

| id | name        | typical kmh | render |
|----|-------------|-------------|--------|
| 0  | motorway    | 100         | widest, "major" |
| 1  | trunk       | 80          | major |
| 2  | primary     | 60          | major |
| 3  | secondary   | 50          | medium |
| 4  | tertiary    | 40          | medium |
| 5  | residential | 30          | minor |
| 6  | service     | 20          | minor |

## Invariants the engine assumes

- The graph is **one weakly-connected component** (the pipeline drops islands).
- For a two-way road, **both** directed edges are present.
- `time_s[i] == len_m[i] / (speed_kmh(klass[i]) * 1000 / 3600)` (free-flow).
- All four edge arrays (`from`, `to`, `len_m`, `time_s`, `klass`) share one length.
- If `geom` is present, `geom[i][0] ≈ nodes[from[i]]` and `geom[i][-1] ≈ nodes[to[i]]`.

## Why JSON (for now)

Readable, diffable, trivial to load. A small/medium city fits in a few MB. If a
larger extract or contraction-hierarchy shortcut layer makes this unwieldy, the
plan is a binary sidecar (typed-array blobs + a small JSON header) behind the
same loader — the in-memory CSR structure the engine builds does not change.
