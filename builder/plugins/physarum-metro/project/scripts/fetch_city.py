#!/usr/bin/env python3
"""fetch-city: estaciones y líneas de metro desde OpenStreetMap (Overpass, ODbL)
+ mosaico satelital Esri World Imagery para el encuadre.

uso: npm run fetch-city -- barcelona   (o: python3 scripts/fetch_city.py barcelona [--no-sat] [--refresh])
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request, io
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "public", "cities")
ENDPOINTS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "physarum-metro-prototype/0.1 (personal research, Barcelona)"

def overpass(q):
    last = None
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.loads(r.read().decode()), ep
        except Exception as e:  # noqa
            last = e
            print("  overpass fail", ep, e)
    raise SystemExit(f"Overpass no respondió: {last}")

def haversine(a, b):
    R = 6371000.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(d))

def merc(lat, lon):
    x = (lon + 180) / 360
    s = math.sin(math.radians(lat))
    y = 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)
    return x, y  # 0..1 world

def frame_for(bb, aspect, pad=0.07):
    """bb en mercator (x0,y0,x1,y1). Devuelve encuadre que contiene bb+pad con aspect=w/h."""
    x0, y0, x1, y1 = bb
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w *= 1 + 2 * pad; h *= 1 + 2 * pad
    if w / h > aspect: h = w / aspect
    else: w = h * aspect
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    cfg = json.load(open(os.path.join(ROOT, "scripts", "cities.json")))
    names = list(cfg) if (not args or args[0] == "all") else args
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    for name in names:
        if name not in cfg:
            raise SystemExit(f"ciudad desconocida: {name}. Opciones: {', '.join(cfg)}")
        build(name, cfg[name], "--refresh" in flags, "--no-sat" not in flags)
    # índice
    idx = []
    for n in cfg:
        p = os.path.join(OUT, f"{n}.json")
        if os.path.exists(p):
            d = json.load(open(p)); idx.append({"id": n, "label": d["label"], "stations": len(d["stations"])})
    json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False, indent=1)

def build(name, c, refresh, sat):
    s, w, n, e = c["bbox"]
    bb = f"({s},{w},{n},{e})"
    rawp = os.path.join(RAW, f"{name}.json")
    if refresh or not os.path.exists(rawp):
        q = f"""[out:json][timeout:200];
relation["route"="subway"]{bb}->.r;
.r out geom;
(
  nwr["railway"="station"]["station"="subway"]{bb};
  nwr["public_transport"="station"]["subway"="yes"]{bb};
);
out center tags;"""
        t0 = time.time()
        data, ep = overpass(q)
        data["_meta"] = {"endpoint": ep, "fetched": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "query": q, "seconds": round(time.time() - t0, 1)}
        json.dump(data, open(rawp, "w"))
        print(f"[{name}] overpass {ep} {data['_meta']['seconds']} s")
    data = json.load(open(rawp))
    els = data["elements"]
    net_re = re.compile(c["networkRe"]) if c.get("networkRe") else None  # estaciones: network+operator
    rel_re = re.compile(c["relNetworkRe"]) if c.get("relNetworkRe") else net_re  # relaciones: network

    # --- líneas (relaciones route=subway) ---
    lines = {}
    for el in els:
        if el["type"] != "relation": continue
        t = el.get("tags", {})
        net = t.get("network", "") if c.get("relNetworkRe") else " ".join([t.get("network", ""), t.get("operator", ""), t.get("network:en", "")])
        if rel_re and not rel_re.search(net): continue
        if not any(m["type"] == "way" for m in el.get("members", [])): continue  # relaciones sin vías (mal etiquetadas)
        ref = t.get("ref") or t.get("name", "?")
        L = lines.setdefault(ref, {"ref": ref, "name": t.get("name", ""), "colour": t.get("colour", ""), "network": t.get("network", ""), "ways": {}, "stops": set()})
        for m in el.get("members", []):
            if m["type"] == "way" and "geometry" in m and m.get("role", "") in ("", "route", "forward", "backward"):
                L["ways"][m["ref"]] = [[round(p["lat"], 6), round(p["lon"], 6)] for p in m["geometry"] if p]
            if m["type"] == "node" and m.get("role", "").startswith("stop") and "lat" in m:
                L["stops"].add((m["lat"], m["lon"]))
    line_pts = []
    for L in lines.values():
        for g in L["ways"].values():
            line_pts.extend(g[:: max(1, len(g) // 40)] if len(g) > 40 else g)
    # puntos densificados para test de cercanía
    def near_line(p, maxd=350):
        for q in line_pts:
            if abs(q[0] - p[0]) < 0.006 and abs(q[1] - p[1]) < 0.008 and haversine(p, q) < maxd:
                return True
        return False

    # --- estaciones ---
    raw_st = []
    for el in els:
        if el["type"] == "relation" and el.get("tags", {}).get("route") == "subway": continue
        t = el.get("tags", {})
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None: continue
        if t.get("railway") not in ("station", None) and t.get("public_transport") != "station": continue
        net = " ".join([t.get("network", ""), t.get("operator", "")])
        raw_st.append({"id": f"{el['type'][0]}{el['id']}", "name": t.get("name", ""), "name_en": t.get("name:en", ""), "lat": lat, "lon": lon, "net": net})
    n_raw = len(raw_st)
    # filtrar: cerca de una línea del sistema (descarta estaciones de otras redes / tags sueltos)
    kept = [r for r in raw_st if near_line((r["lat"], r["lon"]))] if line_pts else raw_st
    if net_re:
        kept = [r for r in kept if (not r["net"].strip()) or net_re.search(r["net"])]
    # fusionar: mismo nombre a < 400 m, o cualquier nombre a < 80 m
    merged = []
    for r in kept:
        hit = None
        for m in merged:
            d = haversine((r["lat"], r["lon"]), (m["lat"], m["lon"]))
            if (r["name"] and r["name"] == m["name"] and d < 400) or d < 80:
                hit = m; break
        if hit:
            hit["ids"].append(r["id"]); k = len(hit["ids"])
            hit["lat"] += (r["lat"] - hit["lat"]) / k; hit["lon"] += (r["lon"] - hit["lon"]) / k
        else:
            merged.append({"name": r["name"], "name_en": r["name_en"], "lat": r["lat"], "lon": r["lon"], "ids": [r["id"]]})
    # líneas por estación (estación a < 300 m de una geometría de línea)
    for m in merged:
        m["lines"] = []
        for L in lines.values():
            for g in L["ways"].values():
                if any(abs(q[0]-m["lat"]) < 0.004 and abs(q[1]-m["lon"]) < 0.005 and haversine((m["lat"], m["lon"]), q) < 300 for q in g):
                    m["lines"].append(L["ref"]); break
        m["lat"] = round(m["lat"], 6); m["lon"] = round(m["lon"], 6)
    dropped = [m["name"] for m in merged if not m["lines"]]
    merged = [m for m in merged if m["lines"]]

    # --- encuadres en mercator ---
    xs, ys = zip(*[merc(m["lat"], m["lon"]) for m in merged])
    sbb = [min(xs), min(ys), max(xs), max(ys)]
    f45 = frame_for(sbb, 0.8); f85 = frame_for(sbb, 1.6)
    region = [min(f45[0], f85[0]), min(f45[1], f85[1]), max(f45[2], f85[2]), max(f45[3], f85[3])]
    out = {
        "id": name, "label": c["label"],
        "source": "© OpenStreetMap contributors (ODbL) vía Overpass API",
        "overpass": data.get("_meta", {}),
        "counts": {"raw_station_elements": n_raw, "after_line_filter": len(kept), "merged_stations": len(merged), "dropped_no_line": dropped,
                   "lines": len(lines), "known": c.get("known")},
        "stationsBBoxMerc": sbb, "region": region,
        "stations": [{k: m[k] for k in ("name", "name_en", "lat", "lon", "lines", "ids")} for m in merged],
        "lines": [{"ref": L["ref"], "name": L["name"], "colour": L["colour"], "network": L["network"],
                   "ways": list(L["ways"].values())} for L in sorted(lines.values(), key=lambda L: L["ref"])],
    }
    if sat:
        out["satellite"] = stitch(name, region)
    json.dump(out, open(os.path.join(OUT, f"{name}.json"), "w"), ensure_ascii=False)
    k = c.get("known", {}).get("stations")
    print(f"[{name}] líneas {len(lines)} · estaciones crudas {n_raw} → filtro {len(kept)} → fusionadas {len(merged)} (referencia {k})")

def stitch(name, region, target_px=2600, max_tiles=260):
    from PIL import Image
    x0, y0, x1, y1 = region
    z = 10
    while z < 17:
        wpx = (x1 - x0) * 256 * 2 ** z
        if wpx >= target_px: break
        z += 1
    def tiles(z):
        n = 2 ** z
        return range(int(x0 * n), int(x1 * n) + 1), range(int(y0 * n), int(y1 * n) + 1)
    tx, ty = tiles(z)
    while len(tx) * len(ty) > max_tiles and z > 10:
        z -= 1; tx, ty = tiles(z)
    cache = os.path.join(ROOT, "data", "tiles")
    os.makedirs(cache, exist_ok=True)
    def get(t):
        x, y = t
        p = os.path.join(cache, f"{z}_{x}_{y}.jpg")
        if not os.path.exists(p):
            url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            for i in range(3):
                try:
                    with urllib.request.urlopen(req, timeout=60) as r:
                        open(p, "wb").write(r.read()); break
                except Exception as e:  # noqa
                    print("   tile retry", x, y, e); time.sleep(1 + i)
        return t, p
    coords = [(x, y) for y in ty for x in tx]
    with ThreadPoolExecutor(6) as ex:
        res = list(ex.map(get, coords))
    W, H = len(tx) * 256, len(ty) * 256
    img = Image.new("RGB", (W, H))
    for (x, y), p in res:
        try:
            img.paste(Image.open(p).convert("RGB"), ((x - tx.start) * 256, (y - ty.start) * 256))
        except Exception as e:  # noqa
            print("   tile bad", x, y, e)
    n = 2 ** z
    # recorte exacto a la región
    px0 = (x0 * n - tx.start) * 256; py0 = (y0 * n - ty.start) * 256
    px1 = (x1 * n - tx.start) * 256; py1 = (y1 * n - ty.start) * 256
    img = img.crop((int(px0), int(py0), int(math.ceil(px1)), int(math.ceil(py1))))
    fn = f"{name}-sat.jpg"
    img.save(os.path.join(OUT, fn), quality=84, optimize=True)
    print(f"[{name}] satélite z{z} {len(coords)} tiles → {img.size}")
    return {"file": fn, "zoom": z, "tiles": len(coords), "size": img.size,
            "attribution": "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community (Esri World Imagery)"}

if __name__ == "__main__":
    main()
