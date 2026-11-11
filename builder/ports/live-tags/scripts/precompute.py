#!/usr/bin/env python3
"""Precompute tracks for the live-tags browser tool.

Invariants (PLAN.md): stable IDs for the counter (no IOU-greedy flicker),
Mixkit plates already on disk, values for measures derived from one px→m scale.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment

ROOT = Path("/workspace/creative-practice/live-tags")
sys.path.insert(0, str(ROOT / "scripts"))
from lib import (  # noqa: E402
    PLATES,
    load_frames,
    sample_hex,
    track_color,
    track_flow_window,
    track_lk,
    yolo_detect,
)

OUT = Path(__file__).resolve().parents[1] / "public" / "tracks"
W, H, FPS = 1080, 1350, 30

# class groups so taxi ↔ car doesn't mint a new id
GROUP = {
    "taxi": "vehicle",
    "car": "vehicle",
    "truck": "vehicle",
    "bus": "vehicle",
    "bicycle": "cycle",
    "motorcycle": "cycle",
    "person": "person",
}

BUCKET = {
    "person": "personas",
    "car": "autos",
    "taxi": "taxis",
    "truck": "autos",
    "bus": "colectivos",
    "bicycle": "bicis",
    "motorcycle": "motos",
}

LABEL_ES = {
    "person": "persona",
    "car": "auto",
    "taxi": "taxi",
    "truck": "camión",
    "bus": "colectivo",
    "bicycle": "bici",
    "motorcycle": "moto",
}


def iou(a, b) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    ua = max(0, ax2 - ax1) * max(0, ay2 - ay1) + max(0, bx2 - bx1) * max(0, by2 - by1) - inter
    return inter / ua if ua else 0.0


def center(xyxy):
    x1, y1, x2, y2 = xyxy
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def area(xyxy):
    x1, y1, x2, y2 = xyxy
    return max(0, x2 - x1) * max(0, y2 - y1)


def shift_box(xyxy, dx, dy, w=W, h=H):
    x1, y1, x2, y2 = xyxy
    return (
        float(np.clip(x1 + dx, 0, w)),
        float(np.clip(y1 + dy, 0, h)),
        float(np.clip(x2 + dx, 0, w)),
        float(np.clip(y2 + dy, 0, h)),
    )


def group_of(cls: str) -> str:
    return GROUP.get(cls, cls)


def max_dist_for(cls: str, box) -> float:
    # gate in pixels: bigger objects may jump more
    diag = math.hypot(box[2] - box[0], box[3] - box[1])
    base = 140.0 if group_of(cls) == "vehicle" else 90.0
    return max(base, diag * 0.9)


class Track:
    def __init__(self, tid: int, det: dict, frame_i: int):
        self.id = tid
        self.cls_votes = Counter({det["cls"]: 1})
        self.xyxy = det["xyxy"]
        self.cxy = det["cxy"]
        self.vx = 0.0
        self.vy = 0.0
        self.born = frame_i
        self.last = frame_i
        self.dead = None
        self.hits = 1
        self.age = 0  # frames since last match
        self.confirmed = False
        self.path: list[dict] = []
        self._append(frame_i, det)

    @property
    def cls(self) -> str:
        return self.cls_votes.most_common(1)[0][0]

    def predict(self, dt: int = 1):
        return shift_box(self.xyxy, self.vx * dt, self.vy * dt)

    def _append(self, i: int, det: dict | None, xyxy=None, cxy=None):
        if det is not None:
            xyxy, cxy = det["xyxy"], det["cxy"]
        self.path.append(
            {
                "f": i,
                "x": round(cxy[0], 1),
                "y": round(cxy[1], 1),
                "x1": int(xyxy[0]),
                "y1": int(xyxy[1]),
                "x2": int(xyxy[2]),
                "y2": int(xyxy[3]),
            }
        )

    def update(self, det: dict, i: int):
        px, py = center(self.xyxy)
        nx, ny = det["cxy"]
        dt = max(1, i - self.last)
        # mild velocity smoothing
        self.vx = 0.6 * self.vx + 0.4 * (nx - px) / dt
        self.vy = 0.6 * self.vy + 0.4 * (ny - py) / dt
        self.xyxy = det["xyxy"]
        self.cxy = det["cxy"]
        self.cls_votes[det["cls"]] += 1
        self.last = i
        self.age = 0
        self.hits += 1
        if self.hits >= 3:
            self.confirmed = True
        self._append(i, det)

    def coast(self, i: int):
        pred = self.predict(1)
        self.xyxy = pred
        self.cxy = center(pred)
        self.age += 1
        self._append(i, None, pred, self.cxy)


def match_cost(tr: Track, det: dict) -> float:
    if group_of(tr.cls) != group_of(det["cls"]):
        return 1e5
    pred = tr.predict(1)
    v = iou(pred, det["xyxy"])
    if v >= 0.15:
        return 1.0 - v
    pc, dc = center(pred), det["cxy"]
    dist = math.hypot(pc[0] - dc[0], pc[1] - dc[1])
    gate = max_dist_for(tr.cls, pred)
    if dist <= gate:
        # worse than any decent IoU, but allowed
        return 1.0 + dist / gate
    return 1e5


def associate(tracks: list[Track], dets: list[dict], max_cost: float = 1.99):
    if not tracks or not dets:
        return [], list(range(len(tracks))), list(range(len(dets)))
    cost = np.full((len(tracks), len(dets)), 1e5, dtype=np.float32)
    for i, tr in enumerate(tracks):
        for j, d in enumerate(dets):
            cost[i, j] = match_cost(tr, d)
    ri, cj = linear_sum_assignment(cost)
    matched, u_tr, u_det = [], set(range(len(tracks))), set(range(len(dets)))
    for i, j in zip(ri, cj):
        if cost[i, j] < max_cost:
            matched.append((i, j))
            u_tr.discard(i)
            u_det.discard(j)
    return matched, sorted(u_tr), sorted(u_det)


def track_stable(frames, conf_th=0.32, max_age=25):
    """Detect every frame, Hungarian + velocity + rebirth + min_hits."""
    tracks: dict[int, Track] = {}
    graveyard: list[Track] = []
    next_id = 1
    n = len(frames)
    for i, f in enumerate(frames):
        dets = [
            d
            for d in yolo_detect(f, conf_th=conf_th)
            if (d["xyxy"][2] - d["xyxy"][0]) >= 18 and (d["xyxy"][3] - d["xyxy"][1]) >= 18
        ]
        live = [t for t in tracks.values() if t.dead is None]
        matched, u_tr, u_det = associate(live, dets)

        for ti, di in matched:
            live[ti].update(dets[di], i)

        # unmatched live tracks: coast, or bury
        for ti in u_tr:
            tr = live[ti]
            if tr.age + 1 > max_age:
                tr.dead = i
                graveyard.append(tr)
            else:
                tr.coast(i)

        # try to revive recently dead tracks before minting ids
        leftover = [dets[j] for j in u_det]
        still = []
        for d in leftover:
            best, best_tr = 1e5, None
            for g in graveyard:
                if g.dead is None:
                    continue
                if i - g.dead > 40:
                    continue
                c = match_cost(g, d)
                if c < best:
                    best, best_tr = c, g
            if best_tr is not None and best < 1.7:
                best_tr.dead = None
                best_tr.update(d, i)
                if best_tr.id not in tracks:
                    tracks[best_tr.id] = best_tr
                if best_tr in graveyard:
                    graveyard.remove(best_tr)
            else:
                still.append(d)

        for d in still:
            tr = Track(next_id, d, i)
            tracks[next_id] = tr
            next_id += 1

        if i % 30 == 0:
            live_n = sum(1 for t in tracks.values() if t.dead is None)
            conf_n = sum(1 for t in tracks.values() if t.confirmed)
            print(f"    frame {i}/{n} live={live_n} confirmed={conf_n} total={len(tracks)}")

    # close hanging tracks
    last = n - 1
    for t in tracks.values():
        if t.dead is None:
            t.dead = last
    return tracks


def pack_yolo_tracks(tracks: dict[int, Track], min_hits=3):
    out = []
    for t in sorted(tracks.values(), key=lambda x: x.id):
        if t.hits < min_hits or not t.confirmed:
            continue
        # drop purely coasted tails after last real hit already handled
        out.append(
            {
                "id": t.id,
                "cls": t.cls,
                "label": LABEL_ES.get(t.cls, t.cls),
                "bucket": BUCKET.get(t.cls),
                "born": t.born,
                "dead": t.dead,
                "hits": t.hits,
                "score": round(path_length(t.path), 1),
                "path": t.path,
            }
        )
    return out


def path_length(path):
    s = 0.0
    for a, b in zip(path, path[1:]):
        s += math.hypot(b["x"] - a["x"], b["y"] - a["y"])
    return s


def net_disp(path):
    if len(path) < 2:
        return 0.0
    return math.hypot(path[-1]["x"] - path[0]["x"], path[-1]["y"] - path[0]["y"])


def point_track(name, label, frames_xy, born=0):
    path = []
    for i, p in enumerate(frames_xy):
        if p is None:
            continue
        path.append({"f": i, "x": round(float(p[0]), 1), "y": round(float(p[1]), 1)})
    if not path:
        return None
    return {
        "id": name,
        "cls": name,
        "label": label,
        "bucket": None,
        "born": born,
        "dead": path[-1]["f"],
        "hits": len(path),
        "score": round(path_length(path), 1),
        "path": path,
    }


def write_json(name: str, payload: dict):
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{name}.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    kb = dest.stat().st_size / 1024
    print(f"  wrote {dest} ({kb:.0f} KB)")
    return dest


def precompute_nyc():
    print("=== NYC (trayectorias + contador) ===")
    frames = load_frames(PLATES / "nyc-45.mp4")
    print(f"  {len(frames)} frames")
    tracks = track_stable(frames, conf_th=0.32, max_age=25)
    packed = pack_yolo_tracks(tracks)
    # stats
    buckets = Counter(t["bucket"] for t in packed if t["bucket"])
    print("  confirmed unique:", dict(buckets), "n=", len(packed))
    moving = [
        t
        for t in packed
        if net_disp(t["path"]) >= 60 and t["score"] >= 80 and (t["dead"] - t["born"]) >= 12
    ]
    print("  moving (for trayectorias default):", len(moving))
    payload = {
        "id": "nyc",
        "plate": "nyc-45.mp4",
        "width": W,
        "height": H,
        "fps": FPS,
        "nFrames": len(frames),
        "tracks": packed,
    }
    write_json("nyc", payload)
    return payload


def paris_landmarks(frames):
    pts = {}
    pts["farol"] = track_lk(frames, (402, 508), static=True)
    pts["auto"] = track_lk(frames, (615, 902), static=True)
    pts["balcón"] = track_lk(frames, (318, 402), static=True)
    pts["base-balcón"] = track_lk(frames, (298, 980), static=True)
    pts["sombrilla"] = track_lk(frames, (930, 670), static=True)
    pts["puerta"] = track_lk(frames, (780, 720), static=True)
    pts["ventana"] = track_lk(frames, (850, 280), static=True)
    pts["reja"] = track_lk(frames, (540, 175), static=True)
    pts["vereda-a"] = track_lk(frames, (140, 1120), static=False)
    pts["vereda-b"] = track_lk(frames, (680, 1020), static=False)
    pts["persona"] = track_color(frames, (35, 860, 40, 50), (95, 50, 60), (130, 255, 230), (0, -58))
    pts["ciclista"] = track_flow_window(frames, (195, 840), 40)
    return pts


def precompute_paris():
    print("=== París (medidas) ===")
    frames = load_frames(PLATES / "paris-45.mp4")
    print(f"  {len(frames)} frames")
    pts = paris_landmarks(frames)
    tracks = []
    labels = {
        "farol": "farol",
        "auto": "auto",
        "balcón": "balcón",
        "base-balcón": "base del balcón",
        "sombrilla": "sombrilla",
        "puerta": "puerta",
        "ventana": "ventana",
        "reja": "reja",
        "vereda-a": "cordón",
        "vereda-b": "fachada",
        "persona": "persona",
        "ciclista": "ciclista",
    }
    for k, series in pts.items():
        tr = point_track(k, labels[k], series)
        if tr:
            tracks.append(tr)

    # one scale: median balcony height in px → 4.2 m (same order as the sketch,
    # but applied to every cota so numbers stay consistent)
    heights = []
    ba = {p["f"]: p for p in next(t for t in tracks if t["id"] == "balcón")["path"]}
    bb = {p["f"]: p for p in next(t for t in tracks if t["id"] == "base-balcón")["path"]}
    for f in ba.keys() & bb.keys():
        heights.append(math.hypot(ba[f]["x"] - bb[f]["x"], ba[f]["y"] - bb[f]["y"]))
    med_h = float(np.median(heights)) if heights else 580.0
    px_per_m = med_h / 4.2
    print(f"  balcony median {med_h:.1f}px → scale {px_per_m:.1f} px/m")

    measures = [
        {
            "id": "alto-balcon",
            "kind": "distance",
            "a": "base-balcón",
            "b": "balcón",
            "title": "alto balcón",
            "unit": "m",
            "appear": 0.6,
        },
        {
            "id": "dist-persona-auto",
            "kind": "distance",
            "a": "persona",
            "b": "auto",
            "title": "persona–auto",
            "unit": "m",
            "appear": 1.6,
        },
        {
            "id": "ancho-vereda",
            "kind": "distance",
            "a": "vereda-a",
            "b": "vereda-b",
            "title": "ancho vereda",
            "unit": "m",
            "appear": 2.8,
        },
        {
            "id": "vel-bici",
            "kind": "speed",
            "a": "ciclista",
            "title": "velocidad",
            "unit": "km/h",
            "appear": 3.8,
            "window": 8,
        },
    ]
    payload = {
        "id": "paris",
        "plate": "paris-45.mp4",
        "width": W,
        "height": H,
        "fps": FPS,
        "nFrames": len(frames),
        "pxPerM": round(px_per_m, 2),
        "tracks": tracks,
        "measures": measures,
    }
    write_json("paris", payload)
    return payload


def precompute_bcn():
    print("=== BCN balcones (atlas) ===")
    frames = load_frames(PLATES / "bcn-balconies-45.mp4")
    print(f"  {len(frames)} frames")
    # (id, label, track_pt, start_frame, sample_frame, sample_xy)
    specs = [
        ("reja", "reja", (720, 820), 0, 0, (720, 820)),
        ("planta", "planta", (320, 350), 0, 0, (320, 350)),
        ("bandera", "bandera", (745, 420), 0, 0, (745, 420)),
        ("piedra", "piedra", (900, 800), 0, 0, (900, 800)),
        ("muro", "muro", (350, 200), 70, 105, (350, 200)),
        ("cielo", "cielo", (700, 80), 70, 105, (700, 80)),
    ]
    tracks = []
    swatches = []
    for i, (tid, label, pt, start, sfi, sxy) in enumerate(specs, start=1):
        if start == 0:
            series = track_lk(frames, pt, static=False)
        else:
            sub = track_lk(frames[start:], pt, static=False)
            series = [None] * start + list(sub)
        tr = point_track(tid, label, series, born=start)
        if not tr:
            continue
        rgb, hx = sample_hex(frames[min(sfi, len(frames) - 1)], sxy[0], sxy[1], r=14, bright=True)
        tr["swatch"] = {"rgb": list(rgb), "hex": hx}
        tr["score"] = 1000 - i * 10  # keep a stable order; all matter
        tracks.append(tr)
        swatches.append({"id": tid, "hex": hx, "rgb": list(rgb)})
        print(f"  {tid} {hx} rgb={rgb}")
    payload = {
        "id": "bcn-balconies",
        "plate": "bcn-balconies-45.mp4",
        "width": W,
        "height": H,
        "fps": FPS,
        "nFrames": len(frames),
        "tracks": tracks,
        "swatches": swatches,
    }
    write_json("bcn-balconies", payload)
    return payload


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    precompute_nyc()
    precompute_paris()
    precompute_bcn()
    print("done")


if __name__ == "__main__":
    main()
