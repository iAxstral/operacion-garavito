#!/usr/bin/env python3
"""Operacion Garavito - Edificio F EXTERIOR tileset (dark / Walking Dead / FNAF mood)."""
import random, json, math, os
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageOps, ImageFont
import numpy as np

OUT = '/home/claude/exterior'
os.makedirs(OUT, exist_ok=True)
T = 32
R = random.Random(2026)
NP = np.random.RandomState(2026)

# ---------------------------------------------------------------- colour helpers
def H(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def clamp(v): return max(0, min(255, int(v)))
def mul(c, k): return tuple(clamp(v * k) for v in c[:3])
def mix(a, b, t): return tuple(clamp(a[i] * (1 - t) + b[i] * t) for i in range(3))
def A(c, a=255): return tuple(c[:3]) + (a,)
def dark(c, f=0.5, sat=0.65):
    r, g, b = c[:3]; gr = 0.3 * r + 0.59 * g + 0.11 * b
    r, g, b = [gr + (v - gr) * sat for v in (r, g, b)]
    return (clamp(r * f * 0.93), clamp(g * f * 0.99), clamp(b * f * 1.06))   # cold tint

P = {
 'paver': dark(H('#cdbcae'), .52), 'mortar': dark(H('#8a7a6e'), .40),
 'plaza': dark(H('#c9c2b6'), .50), 'plaza_j': dark(H('#8d877c'), .40),
 'conc': dark(H('#a59f90'), .50), 'conc_d': dark(H('#6f6a5c'), .42), 'conc_l': dark(H('#c2bcae'), .55),
 'grass': dark(H('#557a34'), .62), 'grass_l': dark(H('#78a044'), .62), 'grass_d': dark(H('#38542a'), .62),
 'dry': dark(H('#8c8446'), .60), 'dirt': dark(H('#6b5138'), .60),
 'hedge': dark(H('#4d6a30'), .55), 'hedge_r': dark(H('#7e3a26'), .60),
 'glass': dark(H('#4f8a84'), .65), 'glass_l': dark(H('#7fb5ad'), .72),
 'steel': dark(H('#59636b'), .62), 'steel_d': dark(H('#2a3036'), .60), 'steel_l': dark(H('#8b979f'), .72),
 'louver': dark(H('#a9aaa4'), .55), 'louver_l': dark(H('#cfd0ca'), .60),
 'yellow': dark(H('#c9a12a'), .70), 'red': dark(H('#c23030'), .66),
 'blue': dark(H('#3a62a8'), .70), 'green_bin': dark(H('#3c8a4a'), .62), 'gray_bin': dark(H('#8a8f93'), .55),
 'wood': dark(H('#8a6440'), .60), 'bark': dark(H('#6b5a48'), .55),
 'leaf': dark(H('#4b7a34'), .55), 'void': (9, 13, 15), 'blood': (96, 12, 12),
}

P['mortar'] = mix(P['paver'], P['mortar'], .55)

# ---------------------------------------------------------------- drawing helpers
def newT(fill=None, size=(T, T)):
    return Image.new('RGBA', size, A(fill) if fill else (0, 0, 0, 0))

def jitter(im, amp=0.06):
    a = np.array(im).astype(np.float32)
    n = NP.uniform(1 - amp, 1 + amp, a.shape[:2])
    a[..., :3] *= n[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').copy()

def blobs(im, color, n, rmin, rmax, alpha, region=None, squash=1.0):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    w, h = im.size; x0, y0, x1, y1 = region or (0, 0, w, h)
    for _ in range(n):
        cx = R.uniform(x0, x1); cy = R.uniform(y0, y1); r = R.uniform(rmin, rmax)
        d.ellipse([cx - r, cy - r * squash, cx + r, cy + r * squash], fill=A(color, alpha))
    return Image.alpha_composite(im, layer)

def rect_a(im, box, color, a):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(layer).rectangle(box, fill=A(color, a))
    return Image.alpha_composite(im, layer)

def vgrad(im, y0, y1, color, a0, a1):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, (y1 - y0))
        d.line([0, y, im.width - 1, y], fill=A(color, int(a0 + (a1 - a0) * t)))
    return Image.alpha_composite(im, layer)

def layer_draw(im, fn):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); fn(ImageDraw.Draw(layer))
    return Image.alpha_composite(im, layer)

def shadow_ellipse(im, box, a=90):
    return layer_draw(im, lambda d: d.ellipse(box, fill=(0, 0, 0, a)))

def irregular(d, cx, cy, r, col, n=14, var=0.35, sq=0.8):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n; rr = r * (1 + R.uniform(-var, var))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a) * sq))
    d.polygon(pts, fill=col)

def crack_lines(im, color, alpha=230, x0=None):
    def f(d):
        x = x0 if x0 is not None else R.randint(6, 24); y = 0; pts = [(x, y)]
        while y < im.height - 1:
            y = min(im.height - 1, y + R.randint(2, 5)); x = max(1, min(im.width - 2, x + R.randint(-3, 3))); pts.append((x, y))
        d.line(pts, fill=A(color, alpha))
        bi = R.randrange(1, len(pts) - 1); bx, by = pts[bi]
        d.line([(bx, by), (bx + R.choice([-1, 1]) * R.randint(4, 9), by + R.randint(1, 4))], fill=A(color, alpha))
    return layer_draw(im, f)

# ================================================================= GROUND TILES
def t_paver(dirty=0, crack=False):
    im = newT(); d = ImageDraw.Draw(im)
    for row in range(4):
        y0 = row * 8; off = 0 if row % 2 == 0 else 8
        for bx in range(-1, 3):
            x0 = bx * 16 + off
            c = mul(P['paver'], R.uniform(.86, 1.1))
            d.rectangle([x0, y0, x0 + 15, y0 + 7], fill=A(c))
            d.line([x0, y0, x0 + 14, y0], fill=A(mul(c, 1.12)))
    for row in range(4):
        y0 = row * 8; off = 0 if row % 2 == 0 else 8
        d.line([0, y0 + 7, T - 1, y0 + 7], fill=A(P['mortar']))
        for bx in range(-1, 3):
            x = bx * 16 + off + 15
            if 0 <= x < T: d.line([x, y0, x, y0 + 7], fill=A(P['mortar']))
    im = jitter(im, .07)
    if dirty:
        im = blobs(im, (18, 16, 12), 5 + dirty * 4, 2, 5, 70)
        if dirty > 1:
            px = im.load()
            for _ in range(26):
                x = R.randrange(T); y = R.choice([7, 15, 23, 31])
                px[x, y] = A(mix(P['grass_d'], P['mortar'], .3))
    if crack: im = crack_lines(im, (10, 9, 8), 255)
    return im

def t_plaza(crack=False):
    im = newT(P['plaza']); im = jitter(im, .05); d = ImageDraw.Draw(im)
    d.line([T - 1, 0, T - 1, T - 1], fill=A(P['plaza_j'])); d.line([0, T - 1, T - 1, T - 1], fill=A(P['plaza_j']))
    d.line([0, 0, T - 2, 0], fill=A(mul(P['plaza'], 1.08)))
    im = blobs(im, (14, 14, 12), 7, 1, 3, 45)
    if crack: im = crack_lines(im, (10, 10, 9), 255)
    return im

def t_grass(kind=0):
    im = newT(P['grass']); px = im.load()
    for y in range(T):
        for x in range(T):
            r = R.random()
            if r < .22: px[x, y] = A(P['grass_d'])
            elif r < (.30 if kind != 1 else .38): px[x, y] = A(P['grass_l'])
    for _ in range(14):
        x = R.randrange(T); y = R.randrange(1, T)
        c = P['grass_l'] if R.random() < .5 else P['grass_d']
        px[x, y] = A(c); px[x, y - 1] = A(c)
    if kind == 2:
        im = blobs(im, P['dry'], 6, 3, 7, 150); im = blobs(im, P['dirt'], 3, 2, 5, 150)
    return im

def t_dirt():
    im = newT(P['dirt']); im = jitter(im, .09); px = im.load()
    for _ in range(18):
        x = R.randrange(1, T - 1); y = R.randrange(1, T - 1)
        px[x, y] = A(mul(P['dirt'], 1.35)); px[x + 1, y + 1] = A(mul(P['dirt'], .6))
    return blobs(im, (20, 14, 10), 5, 3, 7, 60)

def t_edge(side):
    pav = t_paver(); gr = t_grass(1)
    depth = [10 + R.randint(-2, 2) for _ in range(T)]
    depth = [int(sum(depth[max(0, i - 1):i + 2]) / len(depth[max(0, i - 1):i + 2])) for i in range(T)]
    mask = Image.new('L', (T, T), 0); md = ImageDraw.Draw(mask)
    for x in range(T): md.line([x, 0, x, depth[x]], fill=255)
    if side == 's': mask = mask.transpose(Image.FLIP_TOP_BOTTOM)
    elif side == 'w': mask = mask.transpose(Image.TRANSPOSE)
    elif side == 'e': mask = mask.transpose(Image.TRANSPOSE).transpose(Image.FLIP_LEFT_RIGHT)
    im = Image.composite(gr, pav, mask)
    rim = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(3)), mask)
    return Image.composite(newT((16, 18, 12)), im, rim)

def t_hedge(dead=False):
    base = P['hedge'] if not dead else dark(H('#5a5030'), .55)
    im = newT(mul(base, .7)); d = ImageDraw.Draw(im)
    for _ in range(24):
        cx = R.randint(0, 31); cy = R.randint(3, 27); r = R.randint(4, 7)
        col = mul(base, R.choice([.85, 1.0, 1.15]))
        for dx in (-32, 0, 32):
            d.ellipse([cx - r + dx, cy - r, cx + r + dx, cy + r], fill=A(col))
            d.ellipse([cx - r + dx + 1, cy - r + 1, cx + dx - 1, cy - 1], fill=A(mul(col, 1.25)))
    px = im.load()
    for _ in range(14):
        x = R.randrange(T); y = R.randrange(3, 26)
        px[x, y] = A(P['hedge_r'] if not dead else P['dry'])
    im = vgrad(im, 23, 31, (0, 0, 0), 0, 150)
    return jitter(im, .05)

# ================================================================= BUILDING TILES
def wall_base(stain=0):
    im = newT(P['conc']); im = jitter(im, .06)
    for k, y in enumerate((0, 8, 16, 24)):
        im = rect_a(im, [0, y, T - 1, y + 7], (0, 0, 0) if R.random() < .5 else (255, 255, 255), R.randint(6, 16))
    d = ImageDraw.Draw(im)
    for y in (0, 8, 16, 24):
        d.line([0, y, T - 1, y], fill=A(mul(P['conc'], .74)))
        d.line([0, y + 1, T - 1, y + 1], fill=A(mul(P['conc'], 1.08)))
    d.line([0, 0, 0, T - 1], fill=A(mul(P['conc'], .72)))
    for (x, y) in [(8, 4), (24, 4), (8, 20), (24, 20)]:
        d.rectangle([x, y, x + 1, y + 1], fill=A(mul(P['conc'], .42)))
        d.point((x, y + 2), fill=A(mul(P['conc'], 1.2)))
    for _ in range(3 + stain * 4):
        x = R.randint(1, 30); h = R.randint(8, 28); y0 = R.randint(0, 32 - h)
        im = rect_a(im, [x, y0, x, y0 + h], (10, 10, 8), R.randint(35, 75))
    if stain:
        im = blobs(im, (28, 44, 26), 8, 2, 5, 90, region=(0, 16, 32, 32))
        im = blobs(im, (16, 14, 10), 4, 3, 6, 70)
    return im

def t_wall_F():
    im = wall_base()
    im = layer_draw(im, lambda d: d.rectangle([10, 8, 23, 25], fill=(0, 0, 0, 90)))
    d = ImageDraw.Draw(im)
    d.rectangle([9, 7, 22, 24], fill=A(P['steel_d']))
    d.rectangle([9, 7, 22, 24], outline=A(P['steel']))
    c = mul((198, 196, 188), .78)
    d.rectangle([12, 10, 14, 21], fill=A(c)); d.rectangle([12, 10, 19, 12], fill=A(c)); d.rectangle([12, 14, 17, 16], fill=A(c))
    return im

def t_slit():
    im = wall_base(1); d = ImageDraw.Draw(im)
    d.rectangle([12, 2, 19, 29], fill=A(P['steel_d'])); d.rectangle([13, 3, 18, 28], fill=A(P['void']))
    d.line([14, 4, 14, 26], fill=A((30, 44, 46)))
    d.line([11, 30, 20, 30], fill=A(mul(P['conc'], 1.2)))
    return im

def t_conc_base():
    im = wall_base(1)
    im = vgrad(im, 14, 31, (8, 8, 6), 0, 160)
    im = blobs(im, (20, 16, 12), 8, 2, 5, 90, region=(0, 20, 32, 32))
    ImageDraw.Draw(im).line([0, 31, T - 1, 31], fill=A((10, 9, 8)))
    return im

def t_conc_top():
    im = wall_base(); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, 6], fill=A(P['steel_d'])); d.line([0, 0, T - 1, 0], fill=A(P['steel']))
    d.line([0, 6, T - 1, 6], fill=A((6, 8, 10)))
    return vgrad(im, 7, 16, (0, 0, 0), 130, 0)

def t_roof_edge():
    im = newT(P['void']); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, 7], fill=A(P['steel_d'])); d.line([0, 0, T - 1, 0], fill=A(P['steel']))
    d.line([0, 7, T - 1, 7], fill=A((5, 7, 9)))
    for y in range(8, 14):
        d.line([0, y, T - 1, y], fill=A(mix(P['steel'], P['void'], (y - 8) / 6)))
    for x in range(0, T, 8): d.line([x, 8, x, 31], fill=A((18, 22, 24)))
    im = vgrad(im, 14, 31, (0, 0, 0), 0, 120)
    return jitter(im, .05)

LTONES = [1.0, .93, 1.06, .9, 1.02, .95, 1.07, .92]
def t_louver(col=False, broken=False, lit=False):
    gapc = (14, 22, 22) if not lit else (44, 54, 30)
    im = newT(P['void']); d = ImageDraw.Draw(im)
    skip = set(R.sample(range(8), 3)) if broken else set()
    for k in range(8):
        y = k * 4
        d.rectangle([0, y + 2, T - 1, y + 3], fill=A(gapc if k % 2 == 0 or lit else mul(gapc, .6)))
        if k in skip:
            d.rectangle([0, y, T - 1, y + 1], fill=A(mix(P['void'], gapc, .35))); continue
        tn = LTONES[k]
        d.line([0, y, T - 1, y], fill=A(mul(P['louver_l'], tn)))
        d.line([0, y + 1, T - 1, y + 1], fill=A(mul(P['louver'], tn * .62)))
    if broken:
        d.line([(3, 14), (24, 24)], fill=A(P['louver']), width=2)
        d.line([(3, 13), (24, 23)], fill=A(P['louver_l']), width=1)
    if col:
        d.rectangle([28, 0, 31, T - 1], fill=A(P['steel_d'])); d.line([28, 0, 28, T - 1], fill=A(P['steel']))
    return jitter(im, .05)

def t_slab():
    im = newT(P['void']); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, T - 1, 9], fill=A(P['conc_d'])); d.line([0, 0, T - 1, 0], fill=A(mul(P['conc'], .9)))
    d.rectangle([0, 7, T - 1, 8], fill=A(P['steel_d'])); d.line([0, 9, T - 1, 9], fill=A((6, 8, 10)))
    d.line([0, 16, T - 1, 16], fill=A(P['steel'])); d.line([0, 17, T - 1, 17], fill=A(P['steel_d']))
    for x in range(1, T, 4): d.line([x, 17, x, 31], fill=A(mul(P['steel'], .8)))
    return jitter(im, .05)

def _glass_panes(base):
    im = newT(P['steel_d']); d = ImageDraw.Draw(im)
    for (x0, x1) in [(2, 14), (17, 29)]:
        for y in range(2, 29):
            t = (y - 2) / 27
            d.line([x0, y, x1, y], fill=A(mix(mul(base, 1.25), mul(base, .55), t)))
    def refl(dr):
        for (x0, _) in [(2, 14), (17, 29)]:
            dr.polygon([(x0 + 2, 2), (x0 + 5, 2), (x0 + 1, 12), (x0 - 2 + 1, 12)], fill=(255, 255, 255, 34))
            dr.polygon([(x0 + 7, 2), (x0 + 8, 2), (x0 + 3, 16), (x0 + 2, 16)], fill=(255, 255, 255, 22))
    im = layer_draw(im, refl); d = ImageDraw.Draw(im)
    d.rectangle([0, 29, T - 1, 31], fill=A(P['steel_d'])); d.line([0, 29, T - 1, 29], fill=A(P['steel']))
    d.line([15, 0, 15, 31], fill=A(P['steel'])); d.line([16, 0, 16, 31], fill=A(P['steel_d']))
    d.line([0, 0, T - 1, 0], fill=A(P['steel']))
    return im

def t_glass(kind='green'):
    if kind == 'dark': return jitter(_glass_panes(mul(P['glass'], .32)), .04)
    im = _glass_panes(P['glass'])
    if kind == 'cracked':
        def f(d):
            ox, oy = R.randint(6, 10), R.randint(10, 14)
            for _ in range(7):
                a = R.uniform(0, 2 * math.pi); L = R.randint(7, 14)
                pts = [(ox, oy)]; x, y = ox, oy
                for s in range(3):
                    x += math.cos(a) * L / 3 + R.randint(-1, 1); y += math.sin(a) * L / 3 + R.randint(-1, 1); pts.append((x, y))
                d.line(pts, fill=(170, 200, 196, 210))
            d.polygon([(ox - 2, oy), (ox, oy - 2), (ox + 3, oy + 1), (ox + 1, oy + 3)], fill=A(P['void'], 230))
        im = layer_draw(im, f)
    return jitter(im, .04)

def t_boarded():
    im = _glass_panes(mul(P['glass'], .25)); d = ImageDraw.Draw(im)
    for y in (3, 12, 21):
        a = R.randint(-2, 2); b = R.randint(-2, 2)
        c = mul(P['wood'], R.uniform(.8, 1.1))
        d.polygon([(0, y + a), (T - 1, y + b), (T - 1, y + b + 6), (0, y + a + 6)], fill=A(c))
        d.line([(0, y + a + 1), (T - 1, y + b + 1)], fill=A(mul(c, 1.2)))
        d.line([(0, y + a + 5), (T - 1, y + b + 5)], fill=A(mul(c, .6)))
        for gx in range(3):
            gy = y + R.randint(1, 4); x0 = R.randint(0, 20)
            d.line([(x0, gy), (x0 + R.randint(5, 10), gy)], fill=A(mul(c, .7)))
        d.point((3, y + a + 3), fill=A(P['steel_l'])); d.point((T - 4, y + b + 3), fill=A(P['steel_l']))
    return jitter(im, .05)

def t_column():
    im = _glass_panes(mul(P['glass'], .3))
    d = ImageDraw.Draw(im)
    d.rectangle([10, 0, 21, T - 1], fill=A(P['steel'])); d.line([10, 0, 10, T - 1], fill=A(P['steel_l']))
    d.line([21, 0, 21, T - 1], fill=A(P['steel_d'])); d.line([20, 0, 20, T - 1], fill=A(mul(P['steel'], .7)))
    for y in (4, 12, 20, 28):
        d.point((13, y), fill=A(P['steel_l'])); d.point((18, y), fill=A(P['steel_l']))
    return jitter(im, .04)

def t_door_l():
    im = newT(P['steel_d']); d = ImageDraw.Draw(im)
    for y in range(3, 27):
        d.line([2, y, 29, y], fill=A(mix(mul(P['glass'], .5), mul(P['glass'], .2), (y - 3) / 24)))
    def refl(dr): dr.polygon([(5, 3), (10, 3), (4, 16), (2, 16)], fill=(255, 255, 255, 30))
    im = layer_draw(im, refl); d = ImageDraw.Draw(im)
    d.rectangle([0, 26, T - 1, 31], fill=A(P['steel'])); d.line([0, 26, T - 1, 26], fill=A(P['steel_l']))
    d.rectangle([26, 11, 27, 21], fill=A(P['steel_l'])); d.line([28, 11, 28, 21], fill=A(P['steel_d']))
    d.line([0, 0, T - 1, 0], fill=A(P['steel'])); d.line([0, 0, 0, T - 1], fill=A(P['steel']))
    return jitter(im, .04)

# ================================================================= DECALS
def d_shadow_overhang():
    a = np.zeros((T, T, 4), np.uint8); a[..., :3] = (4, 7, 13)
    for y in range(T):
        v = 150 * (1 - y / T) ** 1.3 * (0.85 + 0.15 * ((y // 2) % 2))
        a[y, :, 3] = int(v)
    return Image.fromarray(a, 'RGBA')

def d_blood_a():
    im = newT()
    def f(d):
        irregular(d, 16, 17, 9, A(P['blood'], 225), 16, .35)
        irregular(d, 14, 15, 5, A((66, 8, 8), 240), 12, .3)
        for _ in range(7):
            a = R.uniform(0, 6.28); r = R.randint(11, 15)
            x = 16 + math.cos(a) * r; y = 17 + math.sin(a) * r * .8; s = R.choice([1, 1, 2])
            d.ellipse([x - s, y - s, x + s, y + s], fill=A(P['blood'], 220))
        d.line([(20, 24), (20, 29)], fill=A(P['blood'], 220)); d.line([(12, 25), (12, 28)], fill=A(P['blood'], 220))
        d.point((13, 14), fill=(150, 40, 40, 200)); d.point((14, 13), fill=(150, 40, 40, 160))
    return layer_draw(im, f)

def d_blood_b():
    im = newT()
    def f(d):
        cx, cy = 16, 16
        for _ in range(16):
            a = R.uniform(0, 6.28); r = R.uniform(3, 14)
            x = cx + math.cos(a) * r; y = cy + math.sin(a) * r * .85; s = R.choice([0.6, 1, 1, 1.6])
            d.ellipse([x - s, y - s, x + s, y + s], fill=A(P['blood'], 225))
            if R.random() < .4:
                d.line([(cx + math.cos(a) * 2, cy + math.sin(a) * 2), (x, y)], fill=A(P['blood'], 150))
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=A((70, 9, 9), 235))
    return layer_draw(im, f)

def d_blood_drag():
    im = newT()
    def f(d):
        y = 15
        for x in range(0, T):
            y += R.choice([-1, 0, 0, 1]) * (1 if R.random() < .4 else 0); y = max(11, min(20, y))
            r = 4 - (x / T) * 2 + R.uniform(-.4, .4)
            d.ellipse([x - r, y - r * .7, x + r, y + r * .7], fill=A(P['blood'], 205))
        for _ in range(8):
            d.point((R.randrange(T), R.randint(8, 24)), fill=A(P['blood'], 200))
    return layer_draw(im, f)

def d_crack():
    return crack_lines(newT(), (8, 7, 6), 220)

def d_weeds():
    im = newT()
    def f(d):
        for _ in range(6):
            x = R.randint(3, 28); h = R.randint(6, 11); c = R.choice([P['dry'], P['grass_d'], P['grass'], P['dry']])
            d.line([(x, 31), (x + R.randint(-2, 2), 31 - h)], fill=A(c, 240))
            d.line([(x, 31), (x + R.randint(-4, 4), 31 - h + 2)], fill=A(c, 240))
    return layer_draw(im, f)

def d_debris():
    im = newT()
    def f(d):
        for _ in range(8):
            x = R.randint(3, 26); y = R.randint(4, 26); w = R.randint(2, 5); h = R.randint(2, 4)
            c = mul(R.choice([P['conc'], P['conc_d'], P['paver'], P['mortar']]), R.uniform(.7, 1.1))
            d.polygon([(x, y + h), (x + 1, y), (x + w, y + 1), (x + w + 1, y + h)], fill=A(c, 255))
            d.line([(x, y + h + 1), (x + w + 1, y + h + 1)], fill=(0, 0, 0, 90))
        d.rectangle([20, 9, 25, 12], fill=(120, 116, 104, 235)); d.line([(20, 13), (26, 13)], fill=(0, 0, 0, 90))
    return layer_draw(im, f)

def d_leaves():
    im = newT()
    def f(d):
        for _ in range(14):
            x = R.randint(1, 29); y = R.randint(1, 29)
            c = R.choice([(90, 60, 30), (74, 50, 28), (100, 74, 30), (60, 46, 28)])
            d.ellipse([x, y, x + 2, y + 1], fill=A(c, 230))
    return layer_draw(im, f)

def d_puddle():
    im = newT()
    def f(d):
        irregular(d, 14, 17, 10, (10, 18, 24, 185), 14, .3, .6)
        irregular(d, 20, 14, 5, (10, 18, 24, 185), 10, .3, .6)
        d.arc([6, 12, 20, 20], 200, 320, fill=(70, 92, 100, 130))
    return layer_draw(im, f)

def d_tape():
    im = newT()
    yel = mul(P['yellow'], 1.05); blk = (14, 14, 12)
    def f(d):
        for x in range(T):
            sag = int(2 * math.sin(math.pi * x / T)); y0 = 12 + sag
            for y in range(y0, y0 + 7):
                d.point((x, y), fill=A(yel if ((x + y) // 4) % 2 == 0 else blk, 255))
            d.point((x, y0 + 8), fill=(0, 0, 0, 90))
    return layer_draw(im, f)

# ================================================================= TILE REGISTRY
TILES = []   # (name, category, image, collides)
def reg(name, cat, img, coll=False): TILES.append((name, cat, img, coll))

reg('paver', 'ground', t_paver()); reg('paver_b', 'ground', t_paver()); reg('paver_dirty', 'ground', t_paver(2))
reg('paver_cracked', 'ground', t_paver(1, True)); reg('plaza', 'ground', t_plaza()); reg('plaza_cracked', 'ground', t_plaza(True))
reg('grass_a', 'ground', t_grass(0)); reg('grass_b', 'ground', t_grass(1)); reg('grass_dead', 'ground', t_grass(2))
reg('dirt', 'ground', t_dirt())
for s in 'nswe': reg('edge_grass_' + s, 'ground', t_edge(s))
reg('hedge', 'ground', t_hedge(), True); reg('hedge_dead', 'ground', t_hedge(True), True)
reg('concrete_wall', 'facade', wall_base(), True); reg('concrete_wall_stained', 'facade', wall_base(1), True)
reg('concrete_wall_F', 'facade', t_wall_F(), True); reg('concrete_slit', 'facade', t_slit(), True)
reg('concrete_base', 'facade', t_conc_base(), True); reg('concrete_top', 'facade', t_conc_top(), True)
reg('roof_edge', 'facade', t_roof_edge(), True)
reg('louver', 'facade', t_louver(), True); reg('louver_col', 'facade', t_louver(col=True), True)
reg('louver_broken', 'facade', t_louver(broken=True), True); reg('louver_lit', 'facade', t_louver(lit=True), True)
reg('slab_rail', 'facade', t_slab(), True)
reg('glass_green', 'facade', t_glass('green'), True); reg('glass_cracked', 'facade', t_glass('cracked'), True)
reg('glass_boarded', 'facade', t_boarded(), True); reg('glass_dark', 'facade', t_glass('dark'), True)
reg('steel_column', 'facade', t_column(), True)
_dl = t_door_l(); reg('door_l', 'facade', _dl, False); reg('door_r', 'facade', ImageOps.mirror(_dl), False)
reg('shadow_overhang', 'decal', d_shadow_overhang()); reg('blood_a', 'decal', d_blood_a()); reg('blood_b', 'decal', d_blood_b())
reg('blood_drag', 'decal', d_blood_drag()); reg('crack_decal', 'decal', d_crack()); reg('weeds', 'decal', d_weeds())
reg('debris', 'decal', d_debris()); reg('leaves', 'decal', d_leaves()); reg('puddle', 'decal', d_puddle()); reg('tape_h', 'decal', d_tape())

COLS = 8
ROWS = math.ceil(len(TILES) / COLS)
sheet = Image.new('RGBA', (COLS * T, ROWS * T), (0, 0, 0, 0))
TI = {}
for i, (n, c, im, co) in enumerate(TILES):
    sheet.paste(im, ((i % COLS) * T, (i // COLS) * T)); TI[n] = im
sheet.save(f'{OUT}/exterior_tiles.png')

tileset_json = {
    'image': 'exterior_tiles.png', 'tileWidth': T, 'tileHeight': T, 'columns': COLS, 'tileCount': len(TILES),
    'margin': 0, 'spacing': 0, 'firstgid': 1,
    'note': 'gid = id + 1 (0 = vacio). Rejilla uniforme 32x32 sin margen ni spacing.',
    'tiles': [{'id': i, 'gid': i + 1, 'name': n, 'layer': c, 'collides': co} for i, (n, c, im, co) in enumerate(TILES)]}
json.dump(tileset_json, open(f'{OUT}/exterior_tiles.json', 'w'), indent=1, ensure_ascii=False)

# contact sheet (for humans)
S = 3; cw, ch = 104, 96 + 22
cs = Image.new('RGBA', (COLS * cw, ROWS * ch), (24, 26, 34, 255)); cd = ImageDraw.Draw(cs)
font = ImageFont.load_default()
for i, (n, c, im, co) in enumerate(TILES):
    x = (i % COLS) * cw + 4; y = (i // COLS) * ch + 4
    chk = Image.new('RGBA', (96, 96), (60, 62, 72, 255)); cdd = ImageDraw.Draw(chk)
    for yy in range(0, 96, 12):
        for xx in range(0, 96, 12):
            if ((xx + yy) // 12) % 2 == 0: cdd.rectangle([xx, yy, xx + 11, yy + 11], fill=(50, 52, 60, 255))
    chk = Image.alpha_composite(chk, im.resize((96, 96), Image.NEAREST)); cs.paste(chk, (x, y))
    cd.text((x, y + 98), f'{i} {n[:14]}', fill=(220, 220, 210, 255), font=font)
cs.convert('RGB').save(f'{OUT}/_contact_tiles.png')
print('tiles:', len(TILES), 'sheet', sheet.size)


# ================================================================= PROPS (atlas)
def p_umbrella(torn=False):
    im = newT(size=(64, 64)); im = shadow_ellipse(im, [6, 50, 58, 62], 90); d = ImageDraw.Draw(im)
    d.line([(32, 14), (32, 50)], fill=A(P['steel_d']), width=2)
    d.ellipse([20, 44, 44, 52], fill=A(P['steel'])); d.ellipse([20, 44, 44, 50], fill=A(mul(P['steel'], 1.25)))
    for cx in (12, 52):
        d.rectangle([cx - 4, 44, cx + 4, 50], fill=A(P['red'])); d.rectangle([cx - 4, 38, cx + 4, 43], fill=A(mul(P['red'], .75)))
        d.line([(cx - 4, 51), (cx - 4, 56)], fill=A(P['steel_d'])); d.line([(cx + 4, 51), (cx + 4, 56)], fill=A(P['steel_d']))
    cx, cy, rx, ry = 32, 20, 29, 11; apex = (32, 3); n = 10
    def rim(a): return (cx + rx * math.cos(a), cy + ry * math.sin(a))
    order = sorted(range(n), key=lambda i: -math.sin(2 * math.pi * (i + .5) / n))   # back wedges first
    for i in order:
        a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n
        if torn and i in (2, 7):
            d.line([apex, rim(a0)], fill=A(P['steel_d'])); d.line([apex, rim(a1)], fill=A(P['steel_d'])); continue
        pts = [apex] + [rim(a0 + (a1 - a0) * t / 4) for t in range(5)]
        d.polygon(pts, fill=A(P['red'] if i % 2 == 0 else mul(P['red'], .72)))
    d.arc([cx - rx, cy - ry, cx + rx, cy + ry], 0, 180, fill=A(mul(P['red'], .5)), width=2)
    d.ellipse([30, 2, 34, 5], fill=A(P['steel_d']))
    return jitter(im, .03)

def p_chair(fallen=False):
    im = newT(size=(32, 32)); im = shadow_ellipse(im, [4, 22, 28, 30], 80); d = ImageDraw.Draw(im)
    if not fallen:
        d.rectangle([9, 8, 22, 14], fill=A(mul(P['red'], .75))); d.rectangle([9, 15, 22, 21], fill=A(P['red']))
        for x in (9, 21): d.line([(x, 22), (x, 28)], fill=A(P['steel_d']), width=2)
    else:
        d.polygon([(4, 20), (20, 14), (24, 20), (8, 27)], fill=A(P['red']))
        d.polygon([(20, 14), (28, 10), (30, 16), (24, 20)], fill=A(mul(P['red'], .7)))
        d.line([(6, 26), (3, 30)], fill=A(P['steel_d']), width=2); d.line([(14, 23), (11, 29)], fill=A(P['steel_d']), width=2)
    return jitter(im, .03)

def p_bench():
    im = newT(size=(64, 32)); im = shadow_ellipse(im, [2, 22, 62, 31], 90); d = ImageDraw.Draw(im)
    for x in (6, 54): d.rectangle([x, 8, x + 2, 27], fill=A(P['steel_d']))
    for y0, k in ((8, .85), (13, .85), (18, 1.0), (22, 1.0)):
        d.rectangle([4, y0, 59, y0 + 3], fill=A(mul(P['wood'], k))); d.line([4, y0, 59, y0], fill=A(mul(P['wood'], k * 1.3)))
        for _ in range(4):
            x0 = R.randint(4, 46); d.line([(x0, y0 + 2), (x0 + R.randint(5, 12), y0 + 2)], fill=A(mul(P['wood'], k * .7)))
    d.line([(4, 26), (59, 26)], fill=A(mul(P['wood'], .45)))
    return jitter(im, .03)

def p_sculpture():
    im = newT(size=(64, 96)); im = shadow_ellipse(im, [6, 80, 62, 94], 100); d = ImageDraw.Draw(im)
    d.rectangle([14, 78, 50, 90], fill=A(P['conc_d'])); d.rectangle([14, 78, 50, 80], fill=A(P['conc']))
    y = P['yellow']; yl = mul(y, 1.25); yd = mul(y, .62)
    def beam(box):
        x0, y0, x1, y1 = box
        d.rectangle(box, fill=A(y)); d.line([x0, y0, x0, y1], fill=A(yl)); d.line([x1, y0, x1, y1], fill=A(yd)); d.line([x0, y1, x1, y1], fill=A(yd))
    beam([26, 14, 37, 80]); beam([8, 20, 56, 30]); beam([14, 44, 50, 52])
    d.rectangle([6, 46, 14, 62], fill=A(P['blue'])); d.line([6, 46, 6, 62], fill=A(mul(P['blue'], 1.3)))
    im = blobs(im, (60, 34, 14), 10, 1, 3, 90, region=(8, 20, 56, 80))
    return jitter(im, .03)

def p_palm():
    im = newT(size=(64, 64)); im = shadow_ellipse(im, [12, 48, 52, 62], 90); d = ImageDraw.Draw(im)
    d.polygon([(29, 58), (35, 58), (34, 30), (30, 30)], fill=A(P['bark']))
    for yy in range(32, 58, 4): d.line([(30, yy), (34, yy)], fill=A(mul(P['bark'], .7)))
    cx, cy = 32, 28; fr = []
    for i in range(10):
        a = 2 * math.pi * i / 10 + R.uniform(-.1, .1); fr.append((math.sin(a), a))
    for _, a in sorted(fr):
        L = R.randint(22, 30); pts = []
        for t in range(11):
            u = t / 10; pts.append((cx + math.cos(a) * L * u, cy + math.sin(a) * L * u * .65 + 12 * u * u))
        col = mul(P['leaf'], R.choice([.8, 1, 1.2]))
        d.line(pts, fill=A(col), width=4); d.line(pts, fill=A(mul(col, 1.3)), width=1)
    return jitter(im, .03)

def p_tree(dead=False):
    im = newT(size=(96, 128)); im = shadow_ellipse(im, [12, 108, 84, 126], 95); d = ImageDraw.Draw(im)
    d.polygon([(41, 118), (55, 118), (52, 70), (44, 70)], fill=A(P['bark']))
    for yy in range(76, 118, 5): d.line([(44 + (yy - 76) // 14, yy), (52, yy + 2)], fill=A(mul(P['bark'], .7)))
    d.line([(44, 70), (41, 118)], fill=A(mul(P['bark'], 1.25)))
    if not dead:
        cl = []
        for _ in range(70):
            a = R.uniform(0, 6.28); r = 34 * math.sqrt(R.random())
            cl.append((48 + math.cos(a) * r, 40 + math.sin(a) * r * .95, R.randint(6, 11)))
        for cx, cy, r in sorted(cl, key=lambda c: c[1]):
            top = 1.25 - (cy / 90)
            col = mul(P['leaf'], max(.6, min(1.25, top)) * R.uniform(.9, 1.08))
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=A(mul(col, .8)))
            d.ellipse([cx - r + 1, cy - r + 1, cx + r - 2, cy + r - 3], fill=A(col))
            d.ellipse([cx - r + 2, cy - r + 2, cx - 1, cy - 1], fill=A(mul(col, 1.25)))
    else:
        def branch(x, y, ang, length, depth, w):
            if depth == 0 or length < 4: return
            x2 = x + math.cos(ang) * length; y2 = y + math.sin(ang) * length
            d.line([(x, y), (x2, y2)], fill=A(mul(P['bark'], .85)), width=w)
            branch(x2, y2, ang - R.uniform(.3, .6), length * .74, depth - 1, max(1, w - 1))
            branch(x2, y2, ang + R.uniform(.3, .6), length * .74, depth - 1, max(1, w - 1))
        branch(48, 72, -math.pi / 2, 26, 5, 5)
        branch(48, 82, -math.pi / 2 - .8, 20, 4, 3); branch(48, 86, -math.pi / 2 + .8, 20, 4, 3)
        for _ in range(9):
            x = R.randint(24, 72); y = R.randint(10, 60)
            d.ellipse([x, y, x + 2, y + 1], fill=A((80, 56, 30)))
    return jitter(im, .03)

def p_bins():
    im = newT(size=(32, 32)); im = shadow_ellipse(im, [1, 24, 31, 31], 90); d = ImageDraw.Draw(im)
    for i, c in enumerate((P['blue'], P['green_bin'], P['gray_bin'])):
        x = 2 + i * 10
        d.rectangle([x, 10, x + 8, 27], fill=A(c)); d.line([x, 10, x, 27], fill=A(mul(c, 1.3)))
        d.line([x + 8, 10, x + 8, 27], fill=A(mul(c, .65)))
        d.rectangle([x - 1, 7, x + 9, 10], fill=A(mul(c, .7))); d.line([x - 1, 7, x + 9, 7], fill=A(mul(c, 1.1)))
    return jitter(im, .03)

def p_chess(king=False, white=True):
    im = newT(size=(32, 32)); im = shadow_ellipse(im, [6, 24, 26, 31], 90); d = ImageDraw.Draw(im)
    c = mul((190, 188, 180), .6) if white else (34, 34, 40)
    d.ellipse([8, 22, 24, 29], fill=A(mul(c, .8)))
    d.polygon([(11, 23), (21, 23), (19, 12), (13, 12)], fill=A(c))
    d.ellipse([11, 5, 21, 15], fill=A(c)); d.ellipse([12, 6, 15, 9], fill=A(mul(c, 1.4)))
    if king: d.rectangle([15, 0, 16, 6], fill=A(c)); d.rectangle([13, 2, 18, 3], fill=A(c))
    return jitter(im, .03)

def p_barricade():
    im = newT(size=(64, 32)); im = shadow_ellipse(im, [2, 22, 62, 31], 100); d = ImageDraw.Draw(im)
    for row, y in enumerate((20, 13)):
        for i in range(6):
            x = 4 + i * 10 + (5 if row else 0); c = mul((140, 124, 90), R.uniform(.5, .7))
            d.ellipse([x, y, x + 11, y + 8], fill=A(c)); d.arc([x, y, x + 11, y + 8], 200, 340, fill=A(mul(c, 1.3)))
    for (a, b) in [((6, 2), (56, 24)), ((56, 2), (8, 26))]:
        d.line([a, b], fill=A(mul(P['wood'], .9)), width=4); d.line([(a[0], a[1] - 1), (b[0], b[1] - 1)], fill=A(mul(P['wood'], 1.2)))
        d.point(a, fill=A(P['steel_l'])); d.point(b, fill=A(P['steel_l']))
    return jitter(im, .04)

def p_lamp():
    im = newT(size=(32, 64)); im = shadow_ellipse(im, [6, 54, 26, 63], 90); d = ImageDraw.Draw(im)
    d.rectangle([14, 14, 17, 58], fill=A(P['steel_d'])); d.line([14, 14, 14, 58], fill=A(P['steel']))
    d.rectangle([11, 55, 20, 60], fill=A(P['steel']))
    d.rectangle([8, 6, 23, 14], fill=A(P['steel_d'])); d.line([8, 6, 23, 6], fill=A(P['steel']))
    d.rectangle([10, 12, 21, 15], fill=A((150, 130, 80)))
    return jitter(im, .03)

PROPS = {
 'umbrella_table': (p_umbrella(), (8, 44, 48, 16)), 'umbrella_torn': (p_umbrella(True), (8, 44, 48, 16)),
 'chair_red': (p_chair(), (8, 20, 16, 10)), 'chair_fallen': (p_chair(True), (4, 18, 24, 12)),
 'bench': (p_bench(), (4, 14, 56, 14)), 'sculpture_yellow': (p_sculpture(), (14, 74, 36, 16)),
 'palm': (p_palm(), (26, 50, 12, 10)), 'tree': (p_tree(), (40, 100, 16, 18)), 'tree_dead': (p_tree(True), (40, 100, 16, 18)),
 'bins': (p_bins(), (2, 14, 28, 14)), 'chess_king': (p_chess(True, True), (8, 20, 16, 10)),
 'chess_pawn': (p_chess(False, False), (8, 20, 16, 10)), 'barricade': (p_barricade(), (0, 12, 64, 18)),
 'lamp': (p_lamp(), (11, 52, 10, 8)),
}
# shelf-pack atlas (2px padding), Phaser JSON-hash
PAD = 2; AW = 512; x = y = PAD; rowh = 0; frames = {}; placed = []
for n, (im, col) in sorted(PROPS.items(), key=lambda kv: -kv[1][0].height):
    w, h = im.size
    if x + w + PAD > AW: x = PAD; y += rowh + PAD; rowh = 0
    placed.append((n, im, x, y)); frames[n] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    x += w + PAD; rowh = max(rowh, h)
AH = y + rowh + PAD
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for n, im, px_, py_ in placed: atlas.paste(im, (px_, py_))
atlas.save(f'{OUT}/exterior_props.png')
json.dump({'frames': frames, 'meta': {'image': 'exterior_props.png', 'format': 'RGBA8888', 'size': {'w': AW, 'h': AH}, 'scale': '1'}},
          open(f'{OUT}/exterior_props.json', 'w'), indent=1)
json.dump({n: {'w': im.width, 'h': im.height, 'collider': {'x': c[0], 'y': c[1], 'w': c[2], 'h': c[3]}, 'origin': 'top-left',
                'ySortBy': 'bottom edge (y + h)'} for n, (im, c) in PROPS.items()},
          open(f'{OUT}/exterior_props_meta.json', 'w'), indent=1)

# ================================================================= SCENE (sample map that mirrors the photos)
W, HH = 30, 17
ground = [[R.choices(['grass_a', 'grass_b', 'grass_dead'], [6, 3, 1])[0] for _ in range(W)] for _ in range(HH)]
facade = [[None] * W for _ in range(HH)]
pav = lambda: R.choices(['paver', 'paver_b', 'paver_dirty', 'paver_cracked'], [6, 5, 3, 1])[0]
for yy in range(5, 9):
    for xx in range(0, 22): ground[yy][xx] = pav()
for yy in range(5, 13):
    for xx in range(22, 30): ground[yy][xx] = R.choices(['plaza', 'plaza_cracked'], [6, 1])[0]
for yy in range(9, 17):
    for xx in range(12, 18):
        ground[yy][xx] = 'edge_grass_w' if xx == 12 else 'edge_grass_e' if xx == 17 else pav()
for xx in range(0, 11): ground[9][xx] = 'hedge'
for xx in range(18, 22): ground[9][xx] = 'hedge' if xx < 20 else 'hedge_dead'
# tower (concrete block with F) x0..3
for yy in range(5):
    for xx in range(4):
        n = ['concrete_top', 'concrete_wall', 'concrete_wall', 'concrete_wall', 'concrete_base'][yy]
        if yy == 2 and xx == 1: n = 'concrete_wall_F'
        if yy == 1 and xx == 3: n = 'concrete_slit'
        if yy == 3 and xx in (0, 2): n = 'concrete_wall_stained'
        facade[yy][xx] = n
COLX = {4, 7, 10, 15, 18, 21}
ground_row = {4: 'steel_column', 5: 'glass_green', 6: 'glass_dark', 7: 'steel_column', 8: 'glass_cracked', 9: 'glass_green',
              10: 'steel_column', 11: 'glass_boarded', 12: 'door_l', 13: 'door_r', 14: 'glass_green', 15: 'steel_column',
              16: 'glass_dark', 17: 'glass_green', 18: 'steel_column', 19: 'glass_boarded', 20: 'glass_green', 21: 'steel_column'}
for xx in range(4, 22):
    facade[0][xx] = 'roof_edge'
    for yy in (1, 3): facade[yy][xx] = 'louver_col' if xx in COLX else 'louver'
    facade[2][xx] = 'slab_rail'; facade[4][xx] = ground_row[xx]
facade[1][9] = 'louver_broken'; facade[3][16] = 'louver_broken'; facade[1][12] = 'louver_lit'; facade[3][6] = 'louver_lit'

decals = [('shadow_overhang', xx, 5) for xx in range(4, 22)]
decals += [('blood_b', 12, 5), ('blood_a', 13, 5), ('blood_drag', 13, 6), ('blood_drag', 14, 6), ('blood_a', 15, 7),
           ('debris', 9, 8), ('debris', 3, 6), ('leaves', 6, 7), ('leaves', 17, 8), ('leaves', 14, 12), ('crack_decal', 5, 6),
           ('crack_decal', 24, 9), ('weeds', 15, 6), ('weeds', 2, 8), ('weeds', 16, 10), ('puddle', 16, 11), ('puddle', 26, 11),
           ('tape_h', 11, 5), ('tape_h', 12, 5), ('tape_h', 13, 5), ('blood_b', 26, 8), ('leaves', 25, 6)]
props = [('umbrella_table', 1, 5), ('umbrella_torn', 5, 6), ('chair_red', 4, 7), ('chair_fallen', 9, 7),
         ('sculpture_yellow', 7, 5), ('lamp', 11, 6), ('lamp', 18, 6), ('bench', 9, 10), ('bench', 18, 11),
         ('bins', 20, 7), ('palm', 2, 10), ('tree_dead', 5, 12), ('tree', 24, 0), ('tree', 19, 13),
         ('chess_king', 25, 8), ('chess_pawn', 26, 9), ('chess_pawn', 24, 10), ('chess_king', 27, 7), ('barricade', 22, 6)]

gid = {n: i + 1 for i, (n, c, im, co) in enumerate(TILES)}
def render_scene():
    img = Image.new('RGBA', (W * T, HH * T), (0, 0, 0, 255))
    for yy in range(HH):
        for xx in range(W): img.paste(TI[ground[yy][xx]], (xx * T, yy * T))
    for yy in range(HH):
        for xx in range(W):
            if facade[yy][xx]: img.paste(TI[facade[yy][xx]], (xx * T, yy * T))
    for n, xx, yy in decals: img.alpha_composite(TI[n], (xx * T, yy * T))
    for n, xx, yy in sorted(props, key=lambda p: p[2] * T + PROPS[p[0]][0].height):
        img.alpha_composite(PROPS[n][0], (xx * T, yy * T))
    return img

scene = render_scene(); scene.convert('RGB').save(f'{OUT}/preview_fachada_raw.png')

LIGHTS = [  # x, y (px), radius, color, intensity, note
    (11 * T + 16, 6 * T + 13, 140, (255, 205, 130), 1.0, 'farola calida'),
    (18 * T + 16, 6 * T + 13, 140, (255, 205, 130), 0.9, 'farola calida (parpadea)'),
    (12 * T + 16, 1 * T + 16, 95, (150, 190, 90), 0.6, 'ventana con luz enfermiza'),
    (6 * T + 16, 3 * T + 16, 85, (150, 190, 90), 0.5, 'ventana con luz enfermiza'),
    (13 * T, 4 * T + 16, 100, (220, 50, 40), 0.85, 'luz de emergencia roja en la puerta'),
]
def ambient(img, lights, amb=(.42, .48, .62)):
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255
    h, w = a.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    light = np.zeros((h, w, 3), np.float32)
    for lx, ly, r, col, k, _ in lights:
        dd = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2) / r
        f = np.clip(1 - dd, 0, 1) ** 2 * k
        light += f[..., None] * (np.array(col, np.float32) / 255)
    lit = a * (np.array(amb, np.float32) + light * 1.35)
    vx = (xx - w / 2) / (w / 2); vy = (yy - h / 2) / (h / 2)
    lit *= (1 - .45 * np.clip(vx ** 2 + vy ** 2, 0, 1.4))[..., None]
    return Image.fromarray(np.clip(lit * 255, 0, 255).astype(np.uint8), 'RGB')
ambient(scene, LIGHTS).save(f'{OUT}/preview_fachada_ambiente.png')

grid = lambda L: [[gid[n] if n else 0 for n in row] for row in L]
json.dump({'tileSize': T, 'width': W, 'height': HH, 'tileset': 'exterior_tiles.json', 'propsAtlas': 'exterior_props.json',
           'layers': {'ground': grid(ground), 'facade': grid(facade)},
           'decals': [{'tile': n, 'gid': gid[n], 'x': xx, 'y': yy} for n, xx, yy in decals],
           'props': [{'name': n, 'x': xx * T, 'y': yy * T, 'w': PROPS[n][0].width, 'h': PROPS[n][0].height} for n, xx, yy in props],
           'lights': [{'x': l[0], 'y': l[1], 'radius': l[2], 'color': '#%02x%02x%02x' % l[3], 'intensity': l[4], 'note': l[5]} for l in LIGHTS]},
          open(f'{OUT}/exterior_map_example.json', 'w'))
print('props', len(PROPS), 'atlas', atlas.size, 'scene', scene.size)

# ================================================================= DOC FOR CLAUDE CODE
def hx(c): return '#%02x%02x%02x' % tuple(c[:3])
pal_rows = [('paver (adoquin)','paver'),('mortero','mortar'),('plaza concreto','plaza'),('concreto visto','conc'),('concreto oscuro','conc_d'),
            ('pasto','grass'),('pasto oscuro','grass_d'),('seto','hedge'),('vidrio verde','glass'),('acero','steel'),('acero oscuro','steel_d'),
            ('celosia','louver'),('amarillo escultura','yellow'),('rojo sombrilla/silla','red'),('madera','wood'),('vacio interior','void'),('sangre','blood')]
tab = '\n'.join(f"| {i} | {i+1} | `{n}` | {c} | {'si' if co else 'no'} |" for i, (n, c, _, co) in enumerate(TILES))
pal = '\n'.join(f"| {lbl} | `{hx(P[k])}` |" for lbl, k in pal_rows)
props_tab = '\n'.join(f"| `{n}` | {im.width}x{im.height} | x={c[0]} y={c[1]} w={c[2]} h={c[3]} |" for n, (im, c) in PROPS.items())
doc = f"""# Edificio F — EXTERIOR: guia de tiles para Claude Code

Basado en las fotos reales del Edificio F (torre de concreto visto con placa "F", fachada de celosias metalicas sobre vidrio verde, alero plano oscuro, adoquin, plaza de concreto, cesped, setos, sombrillas rojas, escultura amarilla, canecas, ajedrez gigante). Estetica: **The Walking Dead / FNAF** (fria, desaturada, oscura).

## 1. Reglas (leer primero)
- **Rejilla uniforme 32x32, sin margin ni spacing** (`exterior_tiles.png`, {COLS} columnas x {ROWS} filas = {len(TILES)} tiles). No usar TexturePacker; si hay que agregar tiles se hace en `gen_exterior.py` y se **agregan al final** para no cambiar los gid existentes.
- **gid = id + 1** (0 = vacio). `firstgid = 1`.
- **Perspectiva 3/4:** el piso se ve desde arriba; la fachada se dibuja de frente (como Stardew/Pokemon). Alto de la fachada = 5 filas.
- **Los tiles YA vienen oscuros** (~50% de luminosidad, desaturados, tinte frio). No oscurecerlos mas por tile: la atmosfera final va con overlay + luces (seccion 7b).
- **No cambiar la paleta** (seccion 6). Las sombrillas son rojas **sin logo** a proposito.
- Orden de render: `ground` -> `facade` -> `decals` -> `props` (y-sort por borde inferior: `y + h`) -> luces/oscuridad.

## 2. Archivos
| Archivo | Que es |
|---|---|
| `exterior_tiles.png` / `.json` | Tileset 32x32 (ground + facade + decals). El JSON trae `name`, `layer` y `collides` por tile. |
| `exterior_props.png` / `.json` | Atlas de objetos grandes (formato Phaser JSON-hash, `load.atlas`). |
| `exterior_props_meta.json` | Tamano y `collider` (relativo a la esquina sup-izq del sprite) de cada prop. |
| `exterior_map_example.json` | Mapa de ejemplo 30x17 que replica la vista de las fotos: capas `ground` y `facade` (gids), `decals`, `props`, `lights`. |
| `preview_fachada_raw.png` / `preview_fachada_ambiente.png` | Referencia visual: sin y con iluminacion. **El resultado debe verse como el ambiente.** |
| `gen_exterior.py` | Generador procedural (re-ejecutable, seeds fijos). |

## 3. Tiles ({len(TILES)})
Capas: `ground` = suelo (no colisiona salvo seto), `facade` = pared/vidrio/celosia (colisiona, puerta no), `decal` = overlays transparentes que se dibujan encima del suelo.

| id | gid | nombre | paleta | colisiona |
|---|---|---|---|---|
{tab}

Notas: `edge_grass_<n|s|w|e>` = el cesped ocupa ese lado del tile (borde adoquin/pasto). `shadow_overhang` es la sombra rayada del alero, va en la fila justo debajo de la fachada. `door_l` + `door_r` forman la puerta doble (2 tiles de ancho, sin colision: disparador de entrada).

## 4. Receta de la fachada (coordenadas en tiles, origen arriba-izquierda del mapa)
**Torre de concreto (x=0..3, filas 0..4):** fila0 `concrete_top`; fila1 `concrete_wall` (con `concrete_slit` en x=3); fila2 `concrete_wall` con `concrete_wall_F` en x=1; fila3 `concrete_wall` / `concrete_wall_stained` en x=0 y x=2; fila4 `concrete_base`.

**Fachada principal (x=4..21):**
- fila0: `roof_edge` en todo el ancho.
- fila1 y fila3 (pisos altos): `louver_col` en x in {{4,7,10,15,18,21}} (alineadas con las columnas de abajo), `louver` en el resto. Variantes: `louver_broken` en (9,1) y (16,3); `louver_lit` (luz enfermiza) en (12,1) y (6,3).
- fila2: `slab_rail` en todo el ancho.
- fila4 (planta baja), de x=4 a x=21: `steel_column, glass_green, glass_dark, steel_column, glass_cracked, glass_green, steel_column, glass_boarded, door_l, door_r, glass_green, steel_column, glass_dark, glass_green, steel_column, glass_boarded, glass_green, steel_column`.
- fila5 (suelo frente a la fachada): decal `shadow_overhang` en x=4..21.

**Suelo:** andenes de adoquin (`paver*`) frente al edificio, plaza de concreto (`plaza*`) a la derecha, cesped (`grass_*`) con `edge_grass_*` donde el sendero toca el pasto, setos (`hedge*`) como borde. Ver `exterior_map_example.json` para el layout exacto.

## 5. Props (atlas `exterior_props`)
| nombre | tamano | collider (x,y,w,h) |
|---|---|---|
{props_tab}

## 6. Paleta (ya oscurecida)
| uso | color |
|---|---|
{pal}

## 7. Cargar en Phaser 3
```js
// preload
this.load.spritesheet('ext_sheet', 'assets/exterior/exterior_tiles.png', {{ frameWidth: 32, frameHeight: 32 }});
this.load.image('ext_tiles', 'assets/exterior/exterior_tiles.png');
this.load.atlas('ext_props', 'assets/exterior/exterior_props.png', 'assets/exterior/exterior_props.json');
this.load.json('ext_tileset', 'assets/exterior/exterior_tiles.json');
this.load.json('ext_props_meta', 'assets/exterior/exterior_props_meta.json');
this.load.json('ext_map', 'assets/exterior/exterior_map_example.json');

// create
const data = this.cache.json.get('ext_map');
const solid = this.cache.json.get('ext_tileset').tiles.filter(t => t.collides).map(t => t.gid);
const map = this.make.tilemap({{ tileWidth: 32, tileHeight: 32, width: data.width, height: data.height }});
const ts = map.addTilesetImage('ext_tiles', 'ext_tiles', 32, 32, 0, 0, 1); // firstgid = 1
const ground = map.createBlankLayer('ground', ts).setDepth(0);
const facade = map.createBlankLayer('facade', ts).setDepth(1);
data.layers.ground.forEach((row, y) => row.forEach((g, x) => g && ground.putTileAt(g, x, y)));
data.layers.facade.forEach((row, y) => row.forEach((g, x) => g && facade.putTileAt(g, x, y)));
ground.setCollision(solid); facade.setCollision(solid);

data.decals.forEach(d => this.add.image(d.x * 32, d.y * 32, 'ext_sheet', d.gid - 1).setOrigin(0).setDepth(2));
data.props.forEach(p => this.add.image(p.x, p.y, 'ext_props', p.name).setOrigin(0).setDepth(10 + p.y + p.h));
// colliders: crear cuerpos estaticos con exterior_props_meta.json (x,y,w,h relativos al sprite)
```

## 7b. Ambiente (lo que da el look TWD/FNAF)
- Luz ambiente fria y baja: `this.lights.enable().setAmbientColor(0x6b7a9e)` y `setPipeline('Light2D')` en capas, decals y props.
- Luces desde `data.lights` (`addLight(x, y, radius, color, intensity)`): farolas calidas, ventanas verdosas, luz de emergencia roja en la puerta.
- Parpadeo: tween aleatorio de `intensity` (0.3–1.0) en las farolas, con pausas largas; una de ellas debe fallar de vez en cuando.
- Viñeta oscura en los bordes de la camara. Referencia exacta: `preview_fachada_ambiente.png`.

## 8. Que NO hacer
- No reescalar los tiles con suavizado (usar `pixelArt: true` / NEAREST).
- No mezclar el tileset con otros de tamano distinto en la misma hoja.
- No reordenar tiles existentes; solo agregar al final.
"""
open(f'{OUT}/EXTERIOR_TILES.md', 'w').write(doc)
print('doc ok', len(doc))
