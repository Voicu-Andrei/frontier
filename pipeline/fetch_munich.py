#!/usr/bin/env python3
"""Fetch the REAL Munich road network straight into the RouteLab graph format.

Zero dependencies — Python standard library only (no pyrosm, no shapely, no pip).
It queries the Overpass API, which returns roads as ways that share OSM node ids,
so intersections fall out for free (no geometric noding needed).

Run this on a machine with internet (the build sandbox blocks Overpass):

    python3 fetch_munich.py                      # central Munich, sensible default
    python3 fetch_munich.py --bbox 48.06 11.36 48.22 11.72   # whole city (bigger)
    python3 fetch_munich.py --out ../web/public/data/munich.graph.json

The app prefers munich.graph.json over the synthetic sample automatically, so
just run this and refresh the browser.
"""
from __future__ import annotations
import argparse, json, math, os, sys, time, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timezone

OVERPASS = "https://overpass-api.de/api/interpreter"

# OSM highway tag -> (RouteLab class id, default km/h)
HIGHWAY = {
    "motorway": (0, 100), "motorway_link": (0, 60),
    "trunk": (1, 80), "trunk_link": (1, 50),
    "primary": (2, 60), "primary_link": (2, 40),
    "secondary": (3, 50), "secondary_link": (3, 40),
    "tertiary": (4, 40), "tertiary_link": (4, 30),
    "residential": (5, 30), "living_street": (5, 15), "unclassified": (5, 30),
    "service": (6, 20),
}
# default: central Munich (roughly inside the Mittlerer Ring) — fast to fetch
DEFAULT_BBOX = (48.105, 11.49, 48.175, 11.64)  # S, W, N, E


def haversine_m(a_lon, a_lat, b_lon, b_lat) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi, dlmb = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def overpass(query: str, retries: int = 3) -> dict:
    body = ("data=" + urllib.parse.quote(query)).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "RouteLab/0.4 (capstone)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            wait = 5 * (attempt + 1)
            print(f"  Overpass HTTP {e.code}; retrying in {wait}s…", file=sys.stderr)
            time.sleep(wait)
        except urllib.error.URLError as e:
            print(f"  network error: {e.reason}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise SystemExit("Overpass request failed after retries (are you online?)")


def parse_speed(tags: dict, default_kmh: int) -> float:
    raw = tags.get("maxspeed")
    if raw:
        try:
            return float(str(raw).split()[0])
        except ValueError:
            pass
    return float(default_kmh)


def build(bbox) -> dict:
    s, w, n, e = bbox
    classes = "|".join(HIGHWAY)
    query = (
        f"[out:json][timeout:180];"
        f'way["highway"~"^({classes})$"]({s},{w},{n},{e});'
        f"(._;>;);out body;"
    )
    print(f"querying Overpass for drivable roads in bbox {bbox} …")
    res = overpass(query)
    return build_from_elements(res["elements"])


def build_from_elements(els: list) -> dict:
    coord: dict[int, tuple[float, float]] = {}
    ways = []
    for el in els:
        if el["type"] == "node":
            coord[el["id"]] = (el["lon"], el["lat"])
        elif el["type"] == "way" and "nodes" in el:
            ways.append(el)
    print(f"  {len(coord)} nodes, {len(ways)} ways")

    # a node is a graph vertex if it bounds a way or is shared by 2+ ways
    use_count: dict[int, int] = {}
    for way in ways:
        for nid in way["nodes"]:
            use_count[nid] = use_count.get(nid, 0) + 1

    def is_vertex(nid: int, way_nodes: list[int], i: int) -> bool:
        return i == 0 or i == len(way_nodes) - 1 or use_count.get(nid, 0) > 1

    # split each way into edges between consecutive vertices, keeping geometry
    raw_edges = []  # (u_osm, v_osm, len_m, klass, time_s, geom[[lon,lat]...])
    for way in ways:
        tags = way.get("tags", {})
        hw = tags.get("highway")
        if hw not in HIGHWAY:
            continue
        klass, dflt = HIGHWAY[hw]
        kmh = parse_speed(tags, dflt)
        oneway = str(tags.get("oneway", "")).lower()
        forward_only = oneway in ("yes", "true", "1")
        reverse_only = oneway == "-1"
        nodes = [nid for nid in way["nodes"] if nid in coord]
        if len(nodes) < 2:
            continue

        seg_start = 0
        for i in range(1, len(nodes)):
            if not is_vertex(nodes[i], nodes, i):
                continue
            chunk = nodes[seg_start : i + 1]
            geom = [list(coord[x]) for x in chunk]
            length = sum(haversine_m(*coord[chunk[k]], *coord[chunk[k + 1]]) for k in range(len(chunk) - 1))
            if length > 0:
                t = length / (kmh * 1000.0 / 3600.0)
                u, v = chunk[0], chunk[-1]
                if not reverse_only:
                    raw_edges.append((u, v, length, klass, t, geom))
                if not forward_only:
                    raw_edges.append((v, u, length, klass, t, list(reversed(geom))))
            seg_start = i

    # largest connected component, then dense renumber
    adj: dict[int, set] = {}
    for u, v, *_ in raw_edges:
        adj.setdefault(u, set()).add(v)
        adj.setdefault(v, set()).add(u)
    seen, best = set(), set()
    for start in adj:
        if start in seen:
            continue
        comp, stack = set(), [start]
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x)
            stack.extend(adj[x] - comp)
        seen |= comp
        if len(comp) > len(best):
            best = comp

    keep = sorted(best)
    idx = {o: i for i, o in enumerate(keep)}
    lon = [round(coord[o][0], 6) for o in keep]
    lat = [round(coord[o][1], 6) for o in keep]

    fr, to, len_m, time_s, klass_a, geom_a = [], [], [], [], [], []
    for u, v, length, klass, t, geom in raw_edges:
        if u not in idx or v not in idx:
            continue
        fr.append(idx[u]); to.append(idx[v])
        len_m.append(round(length, 2)); time_s.append(round(t, 2)); klass_a.append(klass)
        geom_a.append([[round(x, 6), round(y, 6)] for x, y in geom])

    bb = [min(lon), min(lat), max(lon), max(lat)]
    return {
        "meta": {
            "name": "munich", "directed": True,
            "center": [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2],
            "bbox": [round(v, 6) for v in bb],
            "speeds_kmh": {"motorway": 100, "trunk": 80, "primary": 60, "secondary": 50,
                           "tertiary": 40, "residential": 30, "service": 20},
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "osm", "node_count": len(keep), "edge_count": len(fr),
        },
        "nodes": {"lon": lon, "lat": lat},
        "edges": {"from": fr, "to": to, "len_m": len_m, "time_s": time_s, "klass": klass_a, "geom": geom_a},
        "features": {"water": [], "parks": [], "rivers": []},
    }


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(os.path.join(here, "..", "web", "public", "data", "munich.graph.json"))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("S", "W", "N", "E"), default=list(DEFAULT_BBOX))
    ap.add_argument("--out", default=default_out)
    args = ap.parse_args()

    graph = build(tuple(args.bbox))
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(graph, f, separators=(",", ":"))
    m = graph["meta"]
    print(f"wrote {args.out}")
    print(f"  REAL Munich: nodes={m['node_count']} edges={m['edge_count']} bbox={m['bbox']}")
    print("  refresh the app — it picks up munich.graph.json automatically.")


if __name__ == "__main__":
    main()
