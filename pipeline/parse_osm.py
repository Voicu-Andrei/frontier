#!/usr/bin/env python3
"""Parse an OSM extract into a drivable road network + render features.

Third-party libraries are fine for *parsing* OSM (that is not the capstone). The
routing itself is implemented from scratch in the TypeScript engine.

Run locally (network is blocked in the build sandbox). Get a Munich-area extract
from Geofabrik, e.g.:

    mkdir -p data
    curl -L -o data/oberbayern.osm.pbf \\
      https://download.geofabrik.de/europe/germany/oberbayern-latest.osm.pbf

Then clip to roughly Munich and parse:

    python3 parse_osm.py data/oberbayern.osm.pbf --bbox 11.40 48.05 11.75 48.25
"""
from __future__ import annotations
import argparse

# highway tag -> RouteLab class id (see GRAPH_FORMAT.md)
HIGHWAY_CLASS = {
    "motorway": 0, "motorway_link": 0,
    "trunk": 1, "trunk_link": 1,
    "primary": 2, "primary_link": 2,
    "secondary": 3, "secondary_link": 3,
    "tertiary": 4, "tertiary_link": 4,
    "residential": 5, "living_street": 5, "unclassified": 5,
    "service": 6,
}


def load_network(pbf_path: str, bbox: tuple[float, float, float, float] | None):
    """Return (edges_gdf, water_gdf, parks_gdf) for the drivable network."""
    from pyrosm import OSM  # imported lazily so the synthetic path needs no deps

    osm = OSM(pbf_path, bounding_box=list(bbox) if bbox else None)
    # nodes=True so edges carry u/v node ids and node coordinates are available.
    nodes, edges = osm.get_network(network_type="driving", nodes=True)
    edges = edges[edges["highway"].isin(HIGHWAY_CLASS)].copy()
    edges["klass"] = edges["highway"].map(HIGHWAY_CLASS)

    try:
        water = osm.get_natural(custom_filter={"natural": ["water"]})
    except Exception:
        water = None
    try:
        parks = osm.get_landuse(custom_filter={"leisure": ["park"], "landuse": ["grass", "forest"]})
    except Exception:
        parks = None
    return nodes, edges, water, parks


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pbf")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("MINLON", "MINLAT", "MAXLON", "MAXLAT"))
    args = ap.parse_args()
    nodes, edges, water, parks = load_network(args.pbf, tuple(args.bbox) if args.bbox else None)
    print(f"parsed: {len(nodes)} nodes, {len(edges)} edge rows")
    print(f"  water polys: {0 if water is None else len(water)}  park polys: {0 if parks is None else len(parks)}")


if __name__ == "__main__":
    main()
