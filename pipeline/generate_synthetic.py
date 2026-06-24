#!/usr/bin/env python3
"""Generate a synthetic, city-like routable graph in the RouteLab graph format.

This is NOT real Munich data (the real path is parse_osm.py -> build_graph.py ->
export.py, run locally against an OSM extract). It exists so the app runs out of
the box on a graph that is *real in every algorithmic sense*: real lon/lat, real
metre lengths, real road-class speeds, one connected component. Routes computed
on it follow its edges (so they sit on the rendered roads), the nodes are real
intersections, and time-bounded search genuinely reaches further along the fast
arterials -> spiky isochrones, all for free.

Usage:
    python3 generate_synthetic.py [out_path] [--cols N] [--rows N] [--seed S]
Default out_path: ../web/public/data/munich-sample.graph.json
"""
from __future__ import annotations
import argparse, json, math, os, random
from datetime import datetime, timezone

# Munich centre (Marienplatz-ish)
CENTER_LON, CENTER_LAT = 11.5755, 48.1372
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON = 111_320.0 * math.cos(math.radians(CENTER_LAT))

# class id -> (name, kmh, is_arterial). Drives speed + render width.
CLASS = {
    0: ("motorway", 100),
    1: ("trunk", 80),
    2: ("primary", 60),
    3: ("secondary", 50),
    4: ("tertiary", 40),
    5: ("residential", 30),
    6: ("service", 20),
}


def xy_to_lonlat(x: float, y: float) -> tuple[float, float]:
    """Local metric XY (east, north) around centre -> WGS84 lon/lat."""
    return (CENTER_LON + x / M_PER_DEG_LON, CENTER_LAT + y / M_PER_DEG_LAT)


def haversine_m(a_lon, a_lat, b_lon, b_lat) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlmb = math.radians(b_lon - a_lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def build(cols: int, rows: int, seed: int) -> dict:
    rnd = random.Random(seed)
    spacing = 145.0          # metres between grid lines
    jitter = 34.0            # positional noise so it reads organic, not graph-paper

    # --- nodes: a jittered grid, id = r*cols + c (kept full for connectivity) ---
    lon: list[float] = [0.0] * (cols * rows)
    lat: list[float] = [0.0] * (cols * rows)
    XY: list[tuple[float, float]] = [(0.0, 0.0)] * (cols * rows)
    cx, cy = (cols - 1) / 2, (rows - 1) / 2
    for r in range(rows):
        for c in range(cols):
            x = (c - cx) * spacing + rnd.uniform(-jitter, jitter)
            y = (cy - r) * spacing + rnd.uniform(-jitter, jitter)  # north = +y
            i = r * cols + c
            XY[i] = (x, y)
            lon[i], lat[i] = xy_to_lonlat(x, y)

    def nid(r, c):
        return r * cols + c

    # --- class field per node-pair via promoted rows/cols + a ring ---
    # default residential; promote every Nth line to an arterial.
    def edge_class(ra, ca, rb, cb) -> int:
        # horizontal edge on a promoted row, or vertical on a promoted col
        if ra == rb:  # horizontal
            if ra % 8 == 3:
                return 2  # primary
            if ra % 4 == 1:
                return 3  # secondary
        if ca == cb:  # vertical
            if ca % 9 == 4:
                return 2  # primary
            if ca % 4 == 2:
                return 3  # secondary
        return 5  # residential

    edges: dict[str, list] = {"from": [], "to": [], "len_m": [], "time_s": [], "klass": []}
    seen: set[tuple[int, int]] = set()

    def add_edge(a: int, b: int, klass: int):
        if a == b or (a, b) in seen:
            return
        d = haversine_m(lon[a], lat[a], lon[b], lat[b])
        if d <= 0:
            return
        kmh = CLASS[klass][1]
        t = d / (kmh * 1000.0 / 3600.0)
        # both directions (two-way roads)
        for u, v in ((a, b), (b, a)):
            seen.add((u, v))
            edges["from"].append(u)
            edges["to"].append(v)
            edges["len_m"].append(round(d, 2))
            edges["time_s"].append(round(t, 2))
            edges["klass"].append(klass)

    # 4-neighbour grid -> guarantees one connected component
    for r in range(rows):
        for c in range(cols):
            if c + 1 < cols:
                add_edge(nid(r, c), nid(r, c + 1), edge_class(r, c, r, c + 1))
            if r + 1 < rows:
                add_edge(nid(r, c), nid(r + 1, c), edge_class(r, c, r + 1, c))

    # --- ring road (trunk): connect grid nodes nearest a circle, gives fast
    #     circumferential routes so A* and isochrones have interesting structure ---
    ring_r = min(cols, rows) * spacing * 0.34

    def nearest_grid(x, y) -> int:
        c = round(x / spacing + cx)
        r = round(cy - y / spacing)
        c = max(0, min(cols - 1, c))
        r = max(0, min(rows - 1, r))
        return nid(r, c)

    ring_nodes: list[int] = []
    steps = 64
    for k in range(steps + 1):
        ang = k / steps * 2 * math.pi
        n = nearest_grid(math.cos(ang) * ring_r, math.sin(ang) * ring_r)
        if not ring_nodes or ring_nodes[-1] != n:
            ring_nodes.append(n)
    for a, b in zip(ring_nodes, ring_nodes[1:]):
        add_edge(a, b, 1)  # trunk

    # --- one diagonal motorway across town (SW -> NE) ---
    diag = []
    for k in range(0, 41):
        t = k / 40
        x = (-0.42 + 0.84 * t) * cols * spacing
        y = (-0.40 + 0.80 * t) * rows * spacing
        n = nearest_grid(x, y)
        if not diag or diag[-1] != n:
            diag.append(n)
    for a, b in zip(diag, diag[1:]):
        add_edge(a, b, 0)  # motorway

    # --- radial arterials (spokes) from the centre. These are what make the
    #     isochrone genuinely spike: reach extends ~2-3x further along them than
    #     across slow residential streets, exactly like real city arterials. ---
    center_node = nid(rows // 2, cols // 2)
    for s in range(9):
        ang = s * (2 * math.pi / 9) + 0.18
        prev = center_node
        for rad in range(1, max(cols, rows) + 2):
            x = math.cos(ang) * rad * spacing
            y = math.sin(ang) * rad * spacing
            c = round(x / spacing + cx)
            r = round(cy - y / spacing)
            if c < 0 or c >= cols or r < 0 or r >= rows:
                break
            n = nid(r, c)
            if n != prev:
                add_edge(prev, n, 1)  # trunk speed -> fast radial corridor
                prev = n

    # --- rendering-only features (water + parks) -----------------------------
    def poly_ellipse(cx_m, cy_m, rx, ry, n=40):
        return [list(xy_to_lonlat(cx_m + math.cos(2 * math.pi * i / n) * rx,
                                  cy_m + math.sin(2 * math.pi * i / n) * ry)) for i in range(n)]

    def poly_rect(cx_m, cy_m, w, h):
        return [list(xy_to_lonlat(cx_m + dx, cy_m + dy))
                for dx, dy in ((-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2))]

    # an Isar-like river sweeping through, with gentle curve
    river_pts = []
    for k in range(0, 33):
        t = k / 32
        x = (-0.55 + 1.15 * t) * cols * spacing
        y = (-0.30 + 0.55 * t) * rows * spacing + math.sin(t * 3.0) * 220
        river_pts.append(list(xy_to_lonlat(x, y)))

    features = {
        "water": [
            poly_ellipse(-cols * spacing * 0.31, rows * spacing * 0.35, 600, 380),   # big lake NW
            poly_ellipse(cols * spacing * 0.38, -rows * spacing * 0.30, 320, 220),   # smaller lake SE
            poly_ellipse(cols * spacing * 0.05, rows * spacing * 0.40, 240, 160),    # pond N
        ],
        "parks": [
            poly_rect(cols * spacing * 0.17, rows * spacing * 0.11, 880, 600),       # big park E
            poly_rect(-cols * spacing * 0.35, -rows * spacing * 0.22, 640, 470),     # park SW
            poly_ellipse(cols * spacing * 0.30, rows * spacing * 0.33, 300, 230),    # round park NE
            poly_rect(-cols * spacing * 0.05, -rows * spacing * 0.36, 520, 300),     # park S
        ],
        "rivers": [{"pts": river_pts, "width_m": 72}],
    }

    lons = lon
    lats = lat
    bbox = [min(lons), min(lats), max(lons), max(lats)]
    return {
        "meta": {
            "name": "munich-synthetic",
            "directed": True,
            "center": [CENTER_LON, CENTER_LAT],
            "bbox": [round(v, 6) for v in bbox],
            "speeds_kmh": {CLASS[k][0]: CLASS[k][1] for k in CLASS},
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "synthetic",
            "node_count": len(lon),
            "edge_count": len(edges["from"]),
        },
        "nodes": {"lon": [round(v, 6) for v in lon], "lat": [round(v, 6) for v in lat]},
        "edges": {**edges, "geom": None},
        "features": features,
    }


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(os.path.join(here, "..", "web", "public", "data", "munich-sample.graph.json"))
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("out", nargs="?", default=default_out)
    ap.add_argument("--cols", type=int, default=56)
    ap.add_argument("--rows", type=int, default=40)
    ap.add_argument("--seed", type=int, default=20260623)
    args = ap.parse_args()

    graph = build(args.cols, args.rows, args.seed)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(graph, f, separators=(",", ":"))
    m = graph["meta"]
    print(f"wrote {args.out}")
    print(f"  nodes={m['node_count']}  edges={m['edge_count']}  bbox={m['bbox']}")


if __name__ == "__main__":
    main()
