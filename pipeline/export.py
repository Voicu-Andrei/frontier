#!/usr/bin/env python3
"""End-to-end: OSM extract -> RouteLab graph file the web app loads.

    python3 export.py data/oberbayern.osm.pbf \\
        --bbox 11.40 48.05 11.75 48.25 \\
        --out ../web/public/data/munich.graph.json

Then point the app at it (web/src/config.ts -> GRAPH_URL) or just overwrite
munich-sample.graph.json. The format is identical to the synthetic generator's,
so nothing in the app changes.
"""
from __future__ import annotations
import argparse, json
from datetime import datetime, timezone

import parse_osm
import build_graph


def _polys(gdf, limit_pts=120):
    """GeoDataFrame of polygons -> list of [[lon,lat],...] rings (exterior only)."""
    out = []
    if gdf is None:
        return out
    for geom in gdf.geometry:
        if geom is None:
            continue
        polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
        for p in polys:
            ring = list(p.exterior.coords)
            if len(ring) > limit_pts:  # downsample very detailed rings
                step = len(ring) // limit_pts + 1
                ring = ring[::step]
            out.append([[round(x, 6), round(y, 6)] for x, y in ring])
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pbf")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("MINLON", "MINLAT", "MAXLON", "MAXLAT"))
    ap.add_argument("--out", default="../web/public/data/munich.graph.json")
    args = ap.parse_args()

    nodes, edges, water, parks = parse_osm.load_network(args.pbf, tuple(args.bbox) if args.bbox else None)
    graph = build_graph.build(nodes, edges)
    graph["meta"]["generated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    graph["features"] = {"water": _polys(water), "parks": _polys(parks), "rivers": []}

    with open(args.out, "w") as f:
        json.dump(graph, f, separators=(",", ":"))
    m = graph["meta"]
    print(f"wrote {args.out}  nodes={m['node_count']} edges={m['edge_count']}")


if __name__ == "__main__":
    main()
