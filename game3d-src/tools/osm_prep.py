"""Turn nysc_osm/*.json (from tools/NYSC_OSM_Extract.ipynb) into small per-state files the game loads: osm/XX.json.
Picks a real named road as the game's main street, rotates the town so that road runs along the game's x axis,
keeps the real buildings/roads/places around it, and lists real landmarks with their true direction.
Data © OpenStreetMap contributors (ODbL).   Usage: python3 tools/osm_prep.py <folder with XX.json> osm/
"""
import json, math, os, sys, glob, re
SRC, OUT = sys.argv[1], sys.argv[2]
HALF = 255
BAND = (-50, 32)          # game street strip (z range) where the game's own buildings stand
W = {'secondary': 1.0, 'tertiary': 1.0, 'primary': 0.85, 'residential': 0.75, 'unclassified': 0.65, 'trunk': 0.45, 'living_street': 0.5}
RW = {'motorway': 16, 'trunk': 14, 'primary': 12, 'secondary': 10, 'tertiary': 8, 'unclassified': 6.5, 'residential': 6, 'living_street': 5, 'service': 4, 'pedestrian': 4, 'track': 3.5,
      'motorway_link': 7, 'trunk_link': 7, 'primary_link': 7, 'secondary_link': 6, 'tertiary_link': 6}
# famous places OSM may not link (approximate positions, for the skyline only)
CURATED = {'OG': [('rock', 'Olumo Rock', 7.1597, 3.3472)], 'FC': [('rock', 'Aso Rock', 9.0836, 7.5353), ('rock', 'Zuma Rock', 9.1281, 7.2353), ('mosque', 'Abuja National Mosque', 9.0597, 7.4894), ('church', 'National Christian Centre', 9.0446, 7.4904)],
           'OD': [('rock', 'Idanre Hills', 7.1050, 5.1100)], 'OY': [('tower', 'Cocoa House', 7.3866, 3.8986), ('block', 'Mapo Hall', 7.3753, 3.8975), ('tower', "Bower's Tower", 7.3958, 3.9156)],
           'KN': [('rock', 'Dala Hill', 12.0040, 8.5060)], 'KW': [('mosque', 'Ilorin Central Mosque', 8.4925, 4.5455)], 'SO': [('mosque', 'Sultan Bello Mosque', 13.0631, 5.2386)],
           'PL': [('rock', 'Shere Hills', 9.9500, 9.0200)], 'NG': [('rock', 'Zuma Rock', 9.1281, 7.2353)]}
def runs(name, ways):
    """join ways of the same street end to end"""
    segs = [w[:] for w in ways]; out = []
    while segs:
        cur = segs.pop(0); grown = True
        while grown:
            grown = False
            for i, s in enumerate(segs):
                if math.dist(cur[-1], s[0]) < 2: cur += s[1:]
                elif math.dist(cur[-1], s[-1]) < 2: cur += s[::-1][1:]
                elif math.dist(cur[0], s[-1]) < 2: cur = s[:-1] + cur
                elif math.dist(cur[0], s[0]) < 2: cur = s[::-1][:-1] + cur
                else: continue
                segs.pop(i); grown = True; break
        out.append(cur)
    return out
def straight(pts, tol=9):
    """longest nearly straight stretch: (length, a, b)"""
    best = (0, None, None)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            a, b = pts[i], pts[j]; L = math.dist(a, b)
            if L < best[0] or L < 1: continue
            dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
            if all(abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) < tol for p in pts[i + 1:j]): best = (L, a, b)
    return best
def pairs(f): return [(f[i], f[i + 1]) for i in range(0, len(f) - 1, 2)]
for f in sorted(glob.glob(os.path.join(SRC, '*.json'))):
    d = json.load(open(f, encoding='utf-8')); sid = d['id']
    byname = {}
    for cls, nm, ln, ow, pts in d['roads']:
        if cls in W: byname.setdefault((nm, cls), []).append(pairs(pts))
    best = None
    for (nm, cls), ways in byname.items():
        for r in runs(nm, ways):
            L, a, b = straight(r)
            if not a: continue
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); dm = math.hypot(*mid)
            if dm > 380: continue
            s = min(L, 320) * W[cls] * (1 if nm else 0.6) - 0.35 * dm
            if not best or s > best[0]: best = (s, nm, cls, a, b, L)
    if best:
        _, road, rcls, a, b, L = best; ox, oy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; th = math.atan2(b[1] - a[1], b[0] - a[0])
    else:
        road, rcls, L, ox, oy, th = '', '', 0, 0, 0, 0
    c, s_ = math.cos(th), math.sin(th)
    T = lambda e, n: (round((e - ox) * c + (n - oy) * s_, 1), round(-(-(e - ox) * s_ + (n - oy) * c), 1))  # game x along road, z = -left
    inband = lambda x, z: abs(x) < HALF + 5 and BAND[0] < z < BAND[1]
    dist = lambda x, z: math.hypot(x, z)
    out = {'id': sid, 'road': road, 'cls': rcls, 'straight': round(L), 'center': d['center'], 'theta': round(math.degrees(th), 1), 'roads': [], 'bld': [], 'green': [], 'water': [], 'poi': [], 'lm': [], 'stop': ''}
    # roads, cut where they enter the game strip
    for cls, nm, ln, ow, pts in d['roads']:
        if cls not in RW: continue
        cur = []
        for e, n in pairs(pts):
            x, z = T(e, n)
            if inband(x, z) or dist(x, z) > 650:
                if len(cur) >= 2: out['roads'].append([cls, nm, [v for p in cur for v in (round(p[0]), round(p[1]))]])
                cur = []
            else: cur.append((x, z))
        if len(cur) >= 2: out['roads'].append([cls, nm, [v for p in cur for v in (round(p[0]), round(p[1]))]])
    # buildings outside the strip, nearest first
    B = []
    for i, (kind, nm, lv, use, pts) in enumerate(d['bld']):
        P = [T(e, n) for e, n in pairs(pts)]
        if len(P) > 1 and P[0] == P[-1]: P = P[:-1]
        if len(P) < 3 or any(inband(x, z) for x, z in P): continue
        cx, cz = sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P)
        if dist(cx, cz) > 430 or kind in ('roof', 'construction', 'ruins'): continue
        area = abs(sum(P[k][0] * P[(k + 1) % len(P)][1] - P[(k + 1) % len(P)][0] * P[k][1] for k in range(len(P)))) / 2
        if area < 8: continue
        h = lv * 3.1 + 0.6 if lv else {'apartments': 11, 'commercial': 8, 'retail': 6.5, 'office': 11, 'hotel': 12, 'church': 9, 'mosque': 7, 'hut': 3.2, 'school': 6.5, 'hospital': 9.5, 'university': 10, 'industrial': 7, 'warehouse': 7}.get(kind, 0)
        if not h: h = 3.6 if area < 180 or (i * 7919) % 10 < 7 else 6.7   # most Nigerian buildings: one or two storeys
        B.append((dist(cx, cz), [round(h, 1), 1 if kind in ('church', 'mosque') or use in ('christian', 'muslim') else 0, [v for p in P for v in (round(p[0], 0), round(p[1], 0))]]))
    B.sort(key=lambda v: v[0]); out['bld'] = [b for _, b in B[:3800]]
    for key in ('green', 'water'):
        for kind, nm, pts in d[key]:
            P = [T(e, n) for e, n in pairs(pts)]
            if not P or min(dist(*p) for p in P) > 500: continue
            if key == 'green' and any(inband(*p) for p in P): continue
            out[key].append([kind, nm, [v for p in P for v in (round(p[0]), round(p[1]))]])
    stops = []
    for kind, nm, e, n in d['poi']:
        x, z = T(e, n)
        if kind == 'bus_stop' and nm: stops.append((abs(z) + abs(x) * 0.3, nm))
        if not nm or dist(x, z) > 520 or inband(x, z) or kind.startswith('place:'): continue
        out['poi'].append([kind, nm[:40], round(x), round(z)])
    if stops: out['stop'] = min(stops)[1]
    # landmarks (deduped by name), with their true direction in game space
    k = 111320 * math.cos(math.radians(d['center'][0]))
    lm = {}
    def typ(kind, rel):
        if re.search(r'natural=(peak|rock|bare_rock|hill|cliff|ridge|stone)', kind): return 'rock'
        if 'place_of_worship' in kind: return 'mosque' if rel == 'muslim' else 'church' if rel == 'christian' else ''
        if 'stadium' in kind: return 'stadium'
        if re.search(r'man_made=(tower|mast|communications_tower|water_tower)', kind): return 'tower'
        if kind.startswith('bridge'): return 'bridge'
        if re.search(r'historic=(monument|memorial)|tourism=artwork|historic=statue', kind): return 'monument'
        if re.search(r'tourism=museum|historic=(castle|palace|city_gate|fort)|historic=building', kind): return 'palace'
        if re.search(r'aeroway', kind): return 'airport'
        if re.search(r'university|hospital|government|building=|office=|tourism=hotel', kind): return 'block'
        return ''
    for kind, nm, dd, br, rel, ele, ht, wd, e, n in d['landmarks']:
        t = typ(kind, rel)
        if not t or nm in lm or dd < 120 or re.search(r'^(Rwy|Runway)|Embass|Ambassad|[Hh]igh [Cc]ommission|Nunciature|Consulate', nm) or 'diplomatic' in kind: continue
        x, z = T(e, n); lm[nm] = [t, nm, round(x), round(z), dd, ht]
    for t, nm, la, lo in CURATED.get(sid, []):
        if any(nm.lower() in v.lower() or v.lower() in nm.lower() for v in lm): continue
        e, n = (lo - d['center'][1]) * k, (la - d['center'][0]) * 111320; x, z = T(e, n)
        lm[nm] = [t, nm, round(x), round(z), round(math.hypot(e, n)), '']
    pri = {'rock': 0, 'mosque': 1, 'church': 1, 'stadium': 2, 'tower': 2, 'bridge': 3, 'monument': 3, 'palace': 3, 'block': 5, 'airport': 6}
    L2 = sorted(lm.values(), key=lambda v: (pri[v[0]], v[4]))
    out['lm'] = L2[:10]
    json.dump(out, open(os.path.join(OUT, sid + '.json'), 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print(f"{sid}: {road or '—'} ({rcls}, {round(L)} m straight) · {len(out['bld'])} bld · {len(out['roads'])} roads · {len(out['poi'])} places · stop: {out['stop'] or '—'} · LM: {', '.join(v[1] for v in out['lm'][:4])} · {os.path.getsize(os.path.join(OUT, sid + '.json')) // 1024} KB")
