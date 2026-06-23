#!/usr/bin/env python3
"""Turn a parsed OSM network into the RouteLab graph (nodes + weighted edges).

Assigns metre lengths and free-flow travel times by road class, keeps the
largest connected component, and renumbers nodes to a dense 0..N-1 index space.
Output is an in-memory dict ready for export.py to serialise.
"""
from __future__ import annotations
import collections, math

# class id -> free-flow speed (km/h). Mirror of generate_synthetic.CLASS.
SPEED_KMH = {0: 100, 1: 80, 2: 60, 3: 50, 4: 40, 5: 30, 6: 20}


def haversine_m(a_lon, a_lat, b_lon, b_lat) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi, dlmb = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def build(nodes_gdf, edges_gdf) -> dict:
    # --- node coordinates keyed by OSM id ---
    coord: dict[int, tuple[float, float]] = {}
    for osmid, geom in zip(nodes_gdf["id"], nodes_gdf.geometry):
        coord[int(osmid)] = (float(geom.x), float(geom.y))

    # --- collect directed edges (respect oneway) ---
    raw = []  # (u_osm, v_osm, len_m, klass, geom_lonlat | None)
    for _, e in edges_gdf.iterrows():
        u, v = int(e["u"]), int(e["v"])
        if u not in coord or v not in coord:
            continue
        klass = int(e["klass"])
        geom = list(e.geometry.coords) if e.geometry is not None else None
        length = float(e.get("length", 0) or 0)
        if length <= 0:
            length = haversine_m(*coord[u], *coord[v])
        oneway = str(e.get("oneway", "no")).lower() in ("yes", "true", "1", "-1")
        raw.append((u, v, length, klass, geom))
        if not oneway:
            rev = list(reversed(geom)) if geom else None
            raw.append((v, u, length, klass, rev))

    # --- largest weakly-connected component ---
    adj = collections.defaultdict(set)
    for u, v, *_ in raw:
        adj[u].add(v)
        adj[v].add(u)
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

    # --- renumber kept nodes to dense 0..N-1 ---
    keep = sorted(best)
    idx = {osm: i for i, osm in enumerate(keep)}
    lon = [coord[o][0] for o in keep]
    lat = [coord[o][1] for o in keep]

    fr, to, len_m, time_s, klass_a, geom_a = [], [], [], [], [], []
    any_geom = False
    for u, v, length, klass, geom in raw:
        if u not in idx or v not in idx:
            continue
        fr.append(idx[u]); to.append(idx[v])
        len_m.append(round(length, 2))
        time_s.append(round(length / (SPEED_KMH[klass] * 1000.0 / 3600.0), 2))
        klass_a.append(klass)
        if geom:
            any_geom = True
        geom_a.append([[round(x, 6), round(y, 6)] for x, y in geom] if geom else None)

    bbox = [min(lon), min(lat), max(lon), max(lat)]
    return {
        "meta": {
            "name": "munich", "directed": True,
            "center": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
            "bbox": [round(v, 6) for v in bbox],
            "speeds_kmh": {n: SPEED_KMH[k] for k, n in
                           {0: "motorway", 1: "trunk", 2: "primary", 3: "secondary",
                            4: "tertiary", 5: "residential", 6: "service"}.items()},
            "source": "osm", "node_count": len(keep), "edge_count": len(fr),
        },
        "nodes": {"lon": [round(v, 6) for v in lon], "lat": [round(v, 6) for v in lat]},
        "edges": {"from": fr, "to": to, "len_m": len_m, "time_s": time_s,
                  "klass": klass_a, "geom": geom_a if any_geom else None},
    }
