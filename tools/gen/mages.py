"""Generator for two mage sprite sets in the goblin's style.
Same canvas (viewBox -48 -52 96 96, 256x256), same outline, same file naming.
"""
import math, os, json, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
OUTLINE = "#1d2b14"

def f(v): return f"{v:.2f}"

def ell(cx, cy, rx, ry, fill, extra=""):
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{extra}/>'

def circ(cx, cy, r, fill, extra=""):
    return ell(cx, cy, r, r, fill, extra)

def poly(pts, fill, extra=""):
    return '<polygon points="' + " ".join(f"{f(x)},{f(y)}" for x, y in pts) + f'" fill="{fill}"{extra}/>'

def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'

NOSTROKE = ' stroke="none"'

def star(cx, cy, r1, r2, n=4, rot=0.0):
    pts = []
    for i in range(n * 2):
        a = rot + math.pi * i / n - math.pi / 2
        r = r1 if i % 2 == 0 else r2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def svg_doc(body, flip=False, vb="-48 -52 96 96", size=256):
    # Drawing coordinates stay centred on (0,0), but the file itself uses a viewBox starting at 0,0:
    # Scratch puts the costume centre at width/2,height/2 and gets it wrong with a negative viewBox origin.
    x, y, w, h = (float(v) for v in vb.split())
    t = f' transform="translate({-x:g} {-y:g}){" scale(-1 1)" if flip else ""}"'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}" height="{h:g}" viewBox="0 0 {w:g} {h:g}">'
            f'<rect x="0" y="0" width="{w:g}" height="{h:g}" fill="#000" fill-opacity="0" stroke="none"/>'
            f'<g stroke="{OUTLINE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"{t}>'
            + "".join(body) + "</g></svg>")

# ---------------------------------------------------------------- palettes
FIRE = dict(
    kind="fire", robe="#c23b2c", shade="#8e2a20", trim="#f2c14e", skin="#f3c79a",
    skinS="#d9a477", hair="#f1f1f4", boot="#4a2e1c", staff="#7a4a26",
    orb="#ff8a1f", orbCore="#ffe27a", glow="#ffb347", flashO="#ff7a1a", flashI="#fff1a0",
)
FROST = dict(
    kind="frost", robe="#2a5fae", shade="#1f4785", trim="#eaf6ff", hood="#3f86d8", fur="#eaf6ff", skin="#f3c79a",
    face="#16203a", eye="#8ff6ff", boot="#2b2f45", staff="#b9c4d0",
    orb="#7fe3ff", orbCore="#eafcff", glow="#9fefff", flashO="#5fd0ff", flashI="#f0fdff",
)

# ---------------------------------------------------------------- pose
def pose(**kw):
    p = dict(bob=0.0, fl=(0, 0), fr=(0, 0), hs=None, ang=0.0, top=30.0, bot=16.0,
             hf=None, glow=1.0, spark=0, sparkPh=0.0, ring=0.0, flash=0.0, burst=0,
             lean=0.0, puff=0.0)
    p.update(kw)
    return p

def staff_points(hx, hy, ang, top, bot):
    a = math.radians(ang)
    dx, dy = math.sin(a), -math.cos(a)
    return (hx + dx * top, hy + dy * top), (hx - dx * bot, hy - dy * bot), (dx, dy)

def draw_staff(P, p, hx, hy):
    (tx, ty), (bx, by), (dx, dy) = staff_points(hx, hy, p["ang"], p["top"], p["bot"])
    out = []
    # stick: dark wide line + coloured narrow line = outlined stick
    out.append(f'<path d="M{f(bx)} {f(by)} L{f(tx)} {f(ty)}" fill="none" stroke="{OUTLINE}" stroke-width="4.8"/>')
    out.append(f'<path d="M{f(bx)} {f(by)} L{f(tx)} {f(ty)}" fill="none" stroke="{P["staff"]}" stroke-width="2.4"/>')
    ox, oy = tx + dx * 3.5, ty + dy * 3.5
    g = p["glow"]
    if g > 0:
        out.append(circ(ox, oy, 5.5 * g, P["glow"], ' fill-opacity=".35"' + NOSTROKE))
    if P["kind"] == "fire":
        # little claw holding the orb
        nx, ny = -dy, dx
        out.append(poly([(tx + nx * 4.5 + dx * 2, ty + ny * 4.5 + dy * 2), (tx + nx * 2, ty + ny * 2), (tx, ty), (tx - nx * 2, ty - ny * 2),
                         (tx - nx * 4.5 + dx * 2, ty - ny * 4.5 + dy * 2), (tx - nx * 2.5 - dx * 1.5, ty - ny * 2.5 - dy * 1.5),
                         (tx + nx * 2.5 - dx * 1.5, ty + ny * 2.5 - dy * 1.5)], P["staff"]))
        out.append(circ(ox, oy, 4.2, P["orb"]))
        out.append(circ(ox - 1, oy - 1, 1.9, P["orbCore"], NOSTROKE))
    else:
        nx, ny = -dy, dx
        L, W = 8.5, 4.6
        c = (ox + dx * 1, oy + dy * 1)
        out.append(poly([(c[0] + dx * L, c[1] + dy * L), (c[0] + nx * W, c[1] + ny * W),
                         (c[0] - dx * L * .7, c[1] - dy * L * .7), (c[0] - nx * W, c[1] - ny * W)], P["orb"]))
        out.append(poly([(c[0] + dx * L * .75, c[1] + dy * L * .75), (c[0] + nx * W * .45, c[1] + ny * W * .45),
                         (c[0] - dx * L * .2, c[1] - dy * L * .2)], P["orbCore"], NOSTROKE))
        # ring that holds the crystal
        out.append(ell(tx, ty, 2.6, 2.6, P["trim"]))
    return out, (ox, oy)

def draw_fx(P, p, ox, oy):
    out = []
    if p["ring"] > 0:
        out.append(circ(ox, oy, p["ring"], "none", f' stroke="{P["glow"]}" stroke-width="1.4" stroke-opacity=".9"'))
    for i in range(p["spark"]):
        a = p["sparkPh"] + i * 2 * math.pi / p["spark"]
        r = 9 + 2 * math.sin(a * 2)
        out.append(poly(star(ox + r * math.cos(a), oy + r * math.sin(a), 2.6, .8, 4, a), P["flashI"],
                        f' stroke="{P["flashO"]}" stroke-width=".8"'))
    if p["flash"] > 0:
        r = p["flash"]
        out.append(poly(star(ox, oy, r, r * .5, 8, p["sparkPh"]), P["flashO"]))
        out.append(poly(star(ox, oy, r * .65, r * .32, 8, p["sparkPh"] + .2), P["flashI"], NOSTROKE))
    if p["puff"] > 0:
        k = p["puff"]
        for i, (ax, ay) in enumerate([(-1, -1), (1, -.6), (0, 1)]):
            out.append(circ(ox + ax * 4 * k, oy + ay * 4 * k, 2.2 + k, "#d9d4cc", ' fill-opacity=".7"' + NOSTROKE))
    return out

# ---------------------------------------------------------------- body parts
def feet(P, p, side):
    if side:
        (ax, ay), (bx, by) = p["fl"], p["fr"]
        return [ell(-2 + bx, 17 + by, 5.5, 3.8, P["shade_boot"] if "shade_boot" in P else P["boot"]),
                ell(-2 + ax, 17 + ay, 5.5, 3.8, P["boot"])]
    return [ell(-6 + p["fl"][0], 17 + p["fl"][1], 5, 3.8, P["boot"]),
            ell(6 + p["fr"][0], 17 + p["fr"][1], 5, 3.8, P["boot"])]

def robe_front(P, b, back=False):
    o = [path(f"M-9 {f(-4+b)} L9 {f(-4+b)} L14 {f(14+b)} Q0 {f(18+b)} -14 {f(14+b)} Z", P["robe"]),
         path(f"M-13.2 {f(11+b)} Q0 {f(15+b)} 13.2 {f(11+b)} L14 {f(14+b)} Q0 {f(18+b)} -14 {f(14+b)} Z", P["trim"])]
    if not back:
        o.append(path(f"M0 {f(6+b)} L0 {f(15.5+b)}", "none"))
    o.append(f'<rect x="-10.6" y="{f(3+b)}" width="21.2" height="3.2" fill="{P["shade"] if back else P["trim"]}" stroke="none"/>')
    return o

def robe_side(P, b, lean):
    return [path(f"M{f(-7+lean)} {f(-4+b)} L{f(7+lean)} {f(-4+b)} L11 {f(14+b)} Q0 {f(17.5+b)} -11 {f(14+b)} Z", P["robe"]),
            path(f"M-10.4 {f(11+b)} Q0 {f(14.5+b)} 10.4 {f(11+b)} L11 {f(14+b)} Q0 {f(17.5+b)} -11 {f(14+b)} Z", P["trim"]),
            f'<rect x="{f(-8.4+lean*.5)}" y="{f(3+b)}" width="16.8" height="3.2" fill="{P["trim"]}" stroke="none"/>']

def hand(P, x, y):
    return [ell(x, y - 1.5, 4.6, 4.8, P["robe"]), circ(x, y + 1.5, 3.4, P["skin"])]

# ---- heads
def head_fire(P, d, b, lean):
    o = []
    if d == "down":
        o += [ell(-12.5, -15 + b, 3.6, 4.8, P["hair"]), ell(12.5, -15 + b, 3.6, 4.8, P["hair"]),
              ell(0, -14 + b, 13.5, 13, P["skin"]),
              path(f"M-10 {f(-11+b)} Q-12 {f(1+b)} 0 {f(8+b)} Q12 {f(1+b)} 10 {f(-11+b)} Q5 {f(-6+b)} 0 {f(-8+b)} Q-5 {f(-6+b)} -10 {f(-11+b)} Z", P["hair"]),
              path(f"M0 {f(-9.5+b)} Q-4 {f(-10.8+b)} -7.5 {f(-7.2+b)} Q-3 {f(-6.6+b)} 0 {f(-7.8+b)} Q3 {f(-6.6+b)} 7.5 {f(-7.2+b)} Q4 {f(-10.8+b)} 0 {f(-9.5+b)} Z", P["hair"]),
              ell(0, -11.3 + b, 2.6, 2.2, P["skinS"])]
        for s in (-1, 1):
            # front eyes: thin outline, pupil without outline + highlight, so they don't turn into dark blobs
            thin = ' stroke-width=".7"'
            o += [ell(5 * s, -15 + b, 3.0, 3.4, "#fff", thin), ell(5 * s, -14.5 + b, 1.45, 1.8, "#000", NOSTROKE),
                  circ(5 * s + .5, -15.3 + b, .55, "#fff", NOSTROKE),
                  poly([(1.8 * s, -19.2 + b), (8.8 * s, -20.4 + b), (8 * s, -18.6 + b)], P["hair"], thin)]
        o += [ell(0, -24 + b, 21, 5.5, P["robe"]),
              path(f"M-12 {f(-25+b)} C-10 {f(-34+b)} -3 {f(-42+b)} 7 {f(-48+b)} C4 {f(-40+b)} 9 {f(-32+b)} 12 {f(-25+b)} Z", P["robe"]),
              path(f"M-12 {f(-25+b)} Q0 {f(-22+b)} 12 {f(-25+b)} L11.3 {f(-28.6+b)} Q0 {f(-25.8+b)} -11.3 {f(-28.6+b)} Z", P["trim"]),
              poly(star(0.5, -34.5 + b, 3.2, 1.3, 5), P["trim"])]
    elif d == "up":
        o += [ell(0, -14 + b, 13.5, 13, P["hair"]),
              path(f"M-13 {f(-17+b)} Q-14 {f(-4+b)} -9 {f(-1+b)} Q-6.5 {f(-4+b)} -4.5 {f(0+b)} Q-2 {f(-3.5+b)} 0 {f(0.5+b)} Q2 {f(-3.5+b)} 4.5 {f(0+b)} Q6.5 {f(-4+b)} 9 {f(-1+b)} Q14 {f(-4+b)} 13 {f(-17+b)} Z", P["hair"]),
              ell(0, -24 + b, 21, 5.5, P["robe"]),
              path(f"M-12 {f(-25+b)} C-9 {f(-32+b)} -4 {f(-42+b)} -7 {f(-48+b)} C3 {f(-41+b)} 10 {f(-34+b)} 12 {f(-25+b)} Z", P["robe"]),
              path(f"M-12 {f(-25+b)} Q0 {f(-22+b)} 12 {f(-25+b)} L11.3 {f(-28.6+b)} Q0 {f(-25.8+b)} -11.3 {f(-28.6+b)} Z", P["trim"])]
    else:  # left
        L = lean
        o += [ell(-1 + L, -14 + b, 12.5, 13, P["skin"]),
              ell(8 + L, -12 + b, 6, 7.5, P["hair"]),
              ell(3.5 + L, -13 + b, 2.4, 3.4, P["skin"]),
              path(f"M{f(-12.5+L)} {f(-10+b)} Q{f(-15+L)} {f(0+b)} {f(-7+L)} {f(7+b)} Q{f(-1+L)} {f(8+b)} {f(2+L)} {f(0+b)} Q{f(3+L)} {f(-6+b)} {f(1+L)} {f(-9+b)} Q{f(-6+L)} {f(-6+b)} {f(-12.5+L)} {f(-10+b)} Z", P["hair"]),
              path(f"M{f(-14+L)} {f(-9.5+b)} Q{f(-9+L)} {f(-11+b)} {f(-4+L)} {f(-8+b)} Q{f(-9+L)} {f(-7+b)} {f(-14+L)} {f(-9.5+b)} Z", P["hair"]),
              ell(-13.6 + L, -11.6 + b, 3.2, 2.7, P["skinS"]),
              ell(-7 + L, -15 + b, 2.5, 3.2, "#fff"), ell(-8.2 + L, -14.5 + b, 1.4, 1.9, "#000"),
              poly([(-11 + L, -19.4 + b), (-3.5 + L, -20.4 + b), (-4.5 + L, -18.4 + b)], P["hair"]),
              ell(0 + L, -24 + b, 19, 4.6, P["robe"]),
              path(f"M{f(-11+L)} {f(-25+b)} C{f(-9+L)} {f(-34+b)} {f(0+L)} {f(-43+b)} {f(16+L)} {f(-47+b)} C{f(9+L)} {f(-40+b)} {f(9+L)} {f(-32+b)} {f(11+L)} {f(-25+b)} Z", P["robe"]),
              path(f"M{f(-11+L)} {f(-25+b)} Q{f(0+L)} {f(-23+b)} {f(11+L)} {f(-25+b)} L{f(10.6+L)} {f(-28.5+b)} Q{f(0+L)} {f(-26.6+b)} {f(-10.6+L)} {f(-28.5+b)} Z", P["trim"]),
              poly(star(0.5 + L, -34 + b, 3, 1.2, 5), P["trim"])]
    return o

def head_frost(P, d, b, lean):
    o = []
    glow = ' fill-opacity=".35"' + NOSTROKE
    H, F = P["hood"], P["fur"]
    if d in ("down", "up"):
        m = 1 if d == "down" else -1   # tip curls to the right when seen from front, left from behind
        o += [path(f"M-15 {f(-5+b)} C-19 {f(-22+b)} -14 {f(-33+b)} {f(-2*m)} {f(-36+b)} C{f(4*m)} {f(-38+b)} {f(9*m)} {f(-42+b)} {f(12*m)} {f(-46+b)} "
                   f"C{f(14*m)} {f(-38+b)} {f(13*m)} {f(-34+b)} {f(12*m)} {f(-32+b)} C18 {f(-26+b)} 18 {f(-14+b)} 15 {f(-5+b)} Q0 {f(-1+b)} -15 {f(-5+b)} Z", H)
              if m == 1 else
              path(f"M15 {f(-5+b)} C19 {f(-22+b)} 14 {f(-33+b)} 2 {f(-36+b)} C-4 {f(-38+b)} -9 {f(-42+b)} -12 {f(-46+b)} "
                   f"C-14 {f(-38+b)} -13 {f(-34+b)} -12 {f(-32+b)} C-18 {f(-26+b)} -18 {f(-14+b)} -15 {f(-5+b)} Q0 {f(-1+b)} 15 {f(-5+b)} Z", H),
              circ(12 * m, -46 + b, 3.6, F)]
        if d == "down":
            o += [ell(0, -14 + b, 12.6, 11.6, F), ell(0, -13.6 + b, 10, 9.2, P["face"])]
            for s in (-1, 1):
                o += [circ(4.2 * s, -13.5 + b, 4, P["eye"], glow), ell(4.2 * s, -13.5 + b, 2.5, 1.7, P["eye"], NOSTROKE)]
        else:
            o += [path(f"M1 {f(-35+b)} Q-2 {f(-20+b)} 0 {f(-5+b)}", "none")]
        o += [path(f"M-13 {f(-6+b)} Q0 {f(0+b)} 13 {f(-6+b)} Q15.5 {f(-2+b)} 12.5 {f(1.5+b)} Q0 {f(6.5+b)} -12.5 {f(1.5+b)} Q-15.5 {f(-2+b)} -13 {f(-6+b)} Z", F)]
        if d == "down":
            o += [poly([(0, 0.5 + b), (2.4, 3.2 + b), (0, 6 + b), (-2.4, 3.2 + b)], P["orb"])]
    else:
        L = lean
        o += [path(f"M{f(-12+L)} {f(-5+b)} C{f(-16+L)} {f(-22+b)} {f(-10+L)} {f(-34+b)} {f(2+L)} {f(-36+b)} C{f(8+L)} {f(-38+b)} {f(14+L)} {f(-42+b)} {f(18+L)} {f(-45+b)} "
                   f"C{f(16+L)} {f(-38+b)} {f(16+L)} {f(-33+b)} {f(14+L)} {f(-30+b)} C{f(16+L)} {f(-22+b)} {f(15+L)} {f(-12+b)} {f(12+L)} {f(-5+b)} Q{f(0+L)} {f(-1+b)} {f(-12+L)} {f(-5+b)} Z", H),
              circ(18 + L, -45 + b, 3.6, F),
              ell(-6.8 + L, -14 + b, 7.6, 10.2, F),
              ell(-7.8 + L, -13.8 + b, 5.6, 8, P["face"]),
              circ(-9.4 + L, -14 + b, 3.6, P["eye"], glow), ell(-9.6 + L, -14 + b, 1.9, 1.6, P["eye"], NOSTROKE),
              path(f"M{f(-11+L)} {f(-6+b)} Q{f(0+L)} {f(-1+b)} {f(11+L)} {f(-6+b)} Q{f(13.5+L)} {f(-2+b)} {f(10.5+L)} {f(1.5+b)} Q{f(0+L)} {f(5.5+b)} {f(-10.5+L)} {f(1.5+b)} Q{f(-13.5+L)} {f(-2+b)} {f(-11+L)} {f(-6+b)} Z", F)]
    return o

# ---------------------------------------------------------------- whole mage
BASE_HANDS = {
    "down": dict(hs=(-16, 4), hf=(15, 4)),
    "up": dict(hs=(16, 4), hf=(-15, 4)),
    "left": dict(hs=(-14, 4), hf=None),
}

def mage(P, d, p):
    side = d == "left"
    b, L = p["bob"], p["lean"]
    hs = p["hs"] or BASE_HANDS[d]["hs"]
    hf = p["hf"] if p["hf"] is not None else BASE_HANDS[d]["hf"]
    head = head_fire if P["kind"] == "fire" else head_frost
    o = [ell(0, 20, 17, 6, "#000", ' fill-opacity=".3"' + NOSTROKE)]
    o += feet(P, p, side)
    staff, orb = draw_staff(P, p, hs[0], hs[1] + b)
    fx = draw_fx(P, p, *orb)
    if d == "down":
        o += robe_front(P, b)
        o += head(P, d, b, 0)
        o += hand(P, hf[0], hf[1] + b)
        o += staff + hand(P, hs[0], hs[1] + b) + fx
    elif d == "up":
        # facing away: staff, orb and spell effects are on the far side -> always behind body and hat
        o += staff + fx
        o += robe_front(P, b, back=True)
        o += head(P, d, b, 0)
        o += hand(P, hf[0], hf[1] + b) + hand(P, hs[0], hs[1] + b)
    else:
        o += robe_side(P, b, L)
        o += head(P, d, b, L)
        o += staff + hand(P, hs[0], hs[1] + b) + fx
    # shift the whole mage down so its content is centred like the goblin's (content centre y = -9)
    return ['<g transform="translate(0 4)">'] + o + ['</g>'], (orb[0], orb[1] + 4)

# ---------------------------------------------------------------- animations
def idle_poses():
    res = []
    for i in range(4):
        b = [0, .6, 1.1, .6][i]
        res.append(pose(bob=b, glow=[1, 1.12, 1.25, 1.12][i]))
    return res

def walk_poses(side):
    res = []
    for i in range(6):
        ph = 2 * math.pi * i / 6
        s = math.sin(ph)
        b = 1.3 * abs(s)
        if side:
            p = pose(bob=b, fl=(-4 * s, -1.8 * max(0, s)), fr=(4 * s, -1.8 * max(0, -s)))
        else:
            p = pose(bob=b, fl=(0, -2.6 * s), fr=(0, 2.6 * s))
        p["_swing"] = s
        res.append(p)
    return res

def apply_walk_hands(d, ps):
    for p in ps:
        s = p.pop("_swing")
        h = BASE_HANDS[d]
        if d == "left":
            p["hs"] = (h["hs"][0] - 1.5 * s, h["hs"][1])
            p["ang"] = -10 + 4 * s
        else:
            p["hs"] = (h["hs"][0], h["hs"][1] - 1.5 * s)
            p["hf"] = (h["hf"][0], h["hf"][1] + 2.6 * s)
    return ps

CAST_FRAMES = 8
RELEASE_FRAME = 6   # 1-based: spawn the projectile on this frame

def cast_poses(d):
    if d == "down":
        return [
            pose(bob=1.2, hs=(-15, 5), ang=-12, glow=1.2, hf=(14, 6)),
            pose(bob=-.5, hs=(-12, -4), ang=12, top=27, glow=1.5, spark=3, sparkPh=0.0, ring=12, hf=(17, -2)),
            pose(bob=-1, hs=(-11, -7), ang=16, top=27, glow=1.7, spark=4, sparkPh=.8, ring=9, hf=(18, -5)),
            pose(bob=-1, hs=(-11, -7), ang=16, top=27, glow=2.0, spark=4, sparkPh=1.6, ring=5.5, hf=(18, -6)),
            pose(bob=1.5, hs=(-12, 0), ang=155, top=9, bot=12, glow=1.6, flash=9, sparkPh=.2, hf=(16, 2)),
            pose(bob=1.8, hs=(-12, 0), ang=155, top=9, bot=12, glow=.6, flash=13, burst=1, sparkPh=.6, hf=(16, 3)),
            pose(bob=.8, hs=(-13, 2), ang=60, top=20, bot=14, glow=.8, puff=1.0, hf=(15, 4)),
            pose(bob=.3, hs=(-16, 4), ang=-4, glow=1.0, puff=1.8, hf=(15, 4)),
        ]
    if d == "up":
        # staff goes up beside the hat (outer side), never over it
        return [
            pose(bob=1.2, hs=(15, 5), ang=10, glow=1.2, hf=(-14, 6)),
            pose(bob=-.5, hs=(14, -3), ang=16, top=28, glow=1.5, spark=3, ring=12, hf=(-17, -2)),
            pose(bob=-1, hs=(13, -6), ang=18, top=28, glow=1.8, spark=4, sparkPh=.8, ring=8.5, hf=(-18, -5)),
            pose(bob=-1, hs=(13, -6), ang=18, top=28, glow=2.2, spark=4, sparkPh=1.6, ring=5.5, hf=(-18, -6)),
            pose(bob=-1, hs=(14, -7), ang=22, top=27, glow=1.6, flash=9, sparkPh=.2, hf=(-16, -1)),
            pose(bob=-1, hs=(14, -7), ang=22, top=27, glow=.6, flash=12, burst=1, sparkPh=.6, hf=(-16, 0)),
            pose(bob=.5, hs=(15, -1), ang=14, glow=.8, puff=1.0, hf=(-15, 3)),
            pose(bob=.2, hs=(16, 4), ang=6, glow=1.0, puff=1.8, hf=(-15, 4)),
        ]
    # left (right = mirrored)
    return [
        pose(bob=1.2, hs=(-9, 4), ang=18, glow=1.2, lean=1.5),
        pose(bob=-.5, hs=(-8, -3), ang=30, glow=1.5, spark=3, ring=13, lean=2),
        pose(bob=-1, hs=(-8, -5), ang=34, glow=1.8, spark=4, sparkPh=.8, ring=9, lean=2),
        pose(bob=-1, hs=(-8, -5), ang=34, glow=2.2, spark=4, sparkPh=1.6, ring=5.5, lean=2),
        pose(bob=.8, hs=(-14, 0), ang=-62, top=19, glow=1.6, flash=9, sparkPh=.2, lean=-2.5),
        pose(bob=1, hs=(-14, 0), ang=-62, top=19, glow=.6, flash=11.5, burst=1, sparkPh=.6, lean=-3),
        pose(bob=.6, hs=(-15, 2), ang=-35, glow=.8, puff=1.0, lean=-1.5),
        pose(bob=.2, hs=(-14, 4), ang=-12, glow=1.0, puff=1.8, lean=0),
    ]

# ---------------------------------------------------------------- projectiles (point to +x, rotate in-engine)
def fireball(i):
    w = [0, 1, 0, -1][i]
    o = ['<g transform="translate(5 0)">', circ(0, 0, 13, "#ff8a1f", ' fill-opacity=".25"' + NOSTROKE),
         path(f"M8 0 C8 -7 1 -9 -4 -8 C-10 {f(-9+w)} -15 {f(-5-w)} -22 {f(-4+w*1.5)} C-17 {f(-1)} -21 {f(2+w)} -16 {f(4+w)} C-12 {f(7-w)} -8 9 -2 8.5 C4 8 8 6 8 0 Z", "#ff6a1a"),
         path(f"M6 0 C6 -4.5 1 -6 -3 -5.5 C-7 {f(-5+w*.6)} -11 {f(-2-w*.6)} -13 {f(-1+w)} C-10 1 -9 {f(3+w*.5)} -5 5 C-1 6.5 6 5 6 0 Z", "#ffd23a", NOSTROKE),
         circ(2.5, -.5, 3, "#fff6c8", NOSTROKE)]
    for k in range(3):
        a = i * .9 + k * 2.1
        o.append(circ(-11 - 5 * k - (i % 2) * 1.5, 5 * math.sin(a), 1.2 - k * .25, "#ffb347", NOSTROKE))
    return o + ['</g>']

def fire_hit(i):
    r = [7, 12, 15, 16, 16][i]
    op = [1, 1, .85, .5, .2][i]
    o = []
    if i < 4:
        o.append(poly(star(0, 0, r, r * .55, 8, i * .3), "#ff6a1a", f' opacity="{op}"'))
        o.append(poly(star(0, 0, r * .62, r * .32, 8, i * .3 + .2), "#ffd23a", f' opacity="{op}"' + NOSTROKE))
    for k in range(6):
        a = k * math.pi / 3 + .4
        d = 5 + i * 2.2
        col = "#ffb347" if i < 2 else "#8a8378"
        o.append(circ(d * math.cos(a), d * math.sin(a) - i * 1.0, 1.6 + i * .8, col,
                      f' opacity="{max(.15, .9 - i * .17):.2f}"' + NOSTROKE))
    return o

def frost_bolt(i):
    w = [0, .6, 0, -.6][i]
    o = ['<g transform="translate(8 0)">', ell(-2, 0, 14, 7, "#9fefff", ' fill-opacity=".25"' + NOSTROKE),
         poly([(12, 0), (2, -5.5), (-14, -2 + w), (-11, 0), (-14, 2 - w), (2, 5.5)], "#7fe3ff"),
         poly([(9, -.5), (2, -3.5), (-8, -1.2)], "#eafcff", NOSTROKE),
         poly([(2, -5.5), (-4, -9), (-2, -3.8)], "#bfe9ff"),
         poly([(2, 5.5), (-4, 9), (-2, 3.8)], "#bfe9ff")]
    for k in range(4):
        x = -15 - 3.5 * k - (i % 2) * 1.5
        y = 4 * math.sin(i * 1.3 + k * 1.9)
        o.append(poly(star(x, y, 2 - k * .3, .6, 4, i * .4), "#eafcff", NOSTROKE))
    return o + ['</g>']

def frost_hit(i):
    o = []
    rr = [6, 10, 13, 15, 16][i]
    op = [1, .9, .7, .45, .2][i]
    o.append(circ(0, 0, rr, "none", f' stroke="#9fefff" stroke-width="{2.6 - i*.4:.2f}" stroke-opacity="{op}"'))
    if i < 2:
        o.append(poly(star(0, 0, 10 + i * 3, 3.5, 6, 0), "#eafcff", NOSTROKE))
    for k in range(7):
        a = k * 2 * math.pi / 7 + .3
        d = 4 + i * 3
        cx, cy = d * math.cos(a), d * math.sin(a) + (i * i * .2)
        s = 4.2 - i * .4
        ca, sa = math.cos(a), math.sin(a)
        o.append(poly([(cx + ca * s * 1.4, cy + sa * s * 1.4), (cx - sa * s * .55, cy + ca * s * .55),
                       (cx - ca * s * .8, cy - sa * s * .8), (cx + sa * s * .55, cy - ca * s * .55)],
                      "#7fe3ff", f' opacity="{max(.2, 1 - i * .2):.2f}" stroke-width="1.2"'))
    return o

# ---------------------------------------------------------------- write
def write(path_, body, flip=False, vb="-48 -52 96 96", size=256):
    with open(path_, "w") as fh:
        fh.write(svg_doc(body, flip, vb, size))

def build(P, name, fx_proj, fx_hit, proj_name, pre):
    d_out = os.path.join(OUT, name)
    os.makedirs(os.path.join(d_out, "fx"), exist_ok=True)
    spawn = {}
    for d in ("down", "up", "left"):
        anims = {
            "idle": idle_poses(),
            "walk": apply_walk_hands(d, walk_poses(d == "left")),
            "cast": cast_poses(d),
        }
        for an, ps in anims.items():
            for i, p in enumerate(ps, 1):
                body, orb = mage(P, d, p)
                write(os.path.join(d_out, f"{pre}{an}_{d}_{i}.svg"), body)
                if d == "left":
                    write(os.path.join(d_out, f"{pre}{an}_right_{i}.svg"), body, flip=True)
                if an == "cast" and i == RELEASE_FRAME:
                    spawn[d] = orb
                    if d == "left":
                        spawn["right"] = (-orb[0], orb[1])
    for i in range(4):
        write(os.path.join(d_out, "fx", f"{pre}{proj_name}_{i+1}.svg"), fx_proj(i), vb="-24 -24 48 48", size=128)
    for i in range(5):
        write(os.path.join(d_out, "fx", f"{pre}{proj_name}_hit_{i+1}.svg"), fx_hit(i), vb="-24 -24 48 48", size=128)
    # spawn point: in viewBox units and in px of the 256px sprite (relative to sprite centre)
    sc = 256 / 96
    info = {
        "sprite_size": 96, "note": "SVG ist 96x96 (fx 48x48), frei skalierbar; spawn_offset_px gilt bei 256px Darstellung", "prefix": pre, "frames": {"idle": 4, "walk": 6, "cast": CAST_FRAMES},
        "cast_release_frame": RELEASE_FRAME,
        "projectile": f"fx/{pre}{proj_name}_1..4.svg (48x48, zeigt nach rechts / +x)",
        "impact": f"fx/{pre}{proj_name}_hit_1..5.svg (48x48)",
        "spawn_offset_px_from_sprite_center": {k: [round(v[0] * sc, 1), round((v[1] + 4) * sc, 1)] for k, v in spawn.items()},
        "scratch_spawn_offset_at_size_100": {k: [round(v[0], 1), round(-(v[1] + 4), 1)] for k, v in spawn.items()},
    }
    with open(os.path.join(d_out, "info.json"), "w") as fh:
        json.dump(info, fh, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    build(FIRE, "feuermagier", fireball, fire_hit, "fireball", "f_")
    build(FROST, "frostmagier", frost_bolt, frost_hit, "frostbolt", "e_")
    print("done")
