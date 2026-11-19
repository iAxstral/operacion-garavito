"""Genera public/bosses/boss_santa.png (Papa Noel malvado) a partir del atlas del jefe.

Mismo formato que boss_ingeniero.png (celdas de 256x256, 8 columnas; fila 0 quieto en
8 direcciones y filas 1-8 caminando), asi BossLayer usa las mismas animaciones. Solo se
toman las 8 poses quietas (las filas de caminar del atlas original vienen mezcladas) y
el andar se arma balanceando cada pose: un bamboleo pesado de 6 cuadros. Sobre cada pose:
  - el traje negro pasa a rojo sangre (el blanco de la camisa queda como piel de armino),
  - un cinturon negro con hebilla dorada,
  - gorro de Papa Noel caido hacia atras y, mirando hacia el frente, barba sucia.

Uso: python3 tools/sprites/boss_santa.py (desde la raiz del repo).
"""
import colorsys
import sys
from PIL import Image, ImageDraw

SRC = 'frontend/public/bosses/boss_ingeniero.png'
DST = 'frontend/public/bosses/boss_santa.png'
CELL = 256
COLS = 8

RED_DARK = (70, 6, 12)
RED = (150, 16, 24)
FUR = (226, 220, 206)
FUR_SHADE = (176, 168, 152)
BEARD = (214, 208, 196)
BEARD_SHADE = (150, 140, 124)
BLOOD = (110, 0, 6)
GOLD = (214, 170, 40)

# Direcciones del atlas: 0 sur, 1 sureste, 2 este, 3 noreste, 4 norte, 5 noroeste, 6 oeste, 7 suroeste.
FRONT = {0: 0, 1: 5, 7: -5}
SIDE = {2: 1, 6: -1}


def recolor(cell):
    px = cell.load()
    for y in range(cell.height):
        for x in range(cell.width):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Traje: oscuro y casi sin color.
            if v < 0.32 and s < 0.35:
                t = v / 0.32
                px[x, y] = (int(70 + t * 130), int(6 + t * 16), int(12 + t * 16), a)
    return cell


def bbox_rows(cell):
    alpha = cell.getchannel('A')
    box = alpha.getbbox()
    return box


def head_box(cell, top):
    """Columnas opacas en las primeras filas de la figura: el ancho de la cabeza."""
    alpha = cell.getchannel('A').load()
    xs = [x for y in range(top, min(top + 26, CELL)) for x in range(CELL) if alpha[x, y] > 60]
    if not xs:
        return None
    xs.sort()
    # Se descartan puntos sueltos (manos o polvo) quedandose con el tramo central.
    lo, hi = xs[len(xs) // 10], xs[-len(xs) // 10 - 1]
    return lo, hi


def draw_belt(cell, top, bottom, cx, half):
    px = cell.load()
    y0 = top + int((bottom - top) * 0.56)
    for y in range(y0, y0 + 9):
        for x in range(max(0, cx - half), min(CELL, cx + half)):
            r, g, b, a = px[x, y]
            if a > 60 and r > g * 2 and r > 40:  # solo sobre el traje (ya rojo)
                px[x, y] = (18, 12, 10, a)
    return y0


def draw_buckle(draw, cx, y0):
    draw.rectangle((cx - 9, y0 - 1, cx + 9, y0 + 9), outline=GOLD, width=3)


def draw_hat(draw, cx, top, width, lean):
    w = max(30, width + 6)
    band_y = top + 16
    # Cono rojo caido hacia un lado, con la punta mas abajo que la base.
    tip = (cx + lean * 44, top - 6)
    draw.polygon([(cx - w // 2 + 2, band_y), (cx + w // 2 - 2, band_y), (cx + lean * 12, top - 26), tip],
                 fill=RED)
    draw.polygon([(cx + lean * 12, top - 26), tip, (cx + lean * 8, top - 10)], fill=RED_DARK)
    # Manchas y rasgon.
    draw.ellipse((cx - 6, top - 14, cx + 2, top - 6), fill=BLOOD)
    # Borde de piel.
    draw.rounded_rectangle((cx - w // 2, band_y - 2, cx + w // 2, band_y + 9), radius=4, fill=FUR)
    draw.line((cx - w // 2 + 3, band_y + 8, cx + w // 2 - 3, band_y + 8), fill=FUR_SHADE, width=2)
    # Pompon.
    draw.ellipse((tip[0] - 7, tip[1] - 6, tip[0] + 7, tip[1] + 8), fill=FUR)
    draw.ellipse((tip[0] - 3, tip[1] + 2, tip[0] + 5, tip[1] + 7), fill=FUR_SHADE)


def draw_beard(draw, cx, top, width, shift):
    w = max(22, width - 8)
    y0 = top + 42
    x0 = cx + shift
    draw.polygon([(x0 - w // 2, y0), (x0 + w // 2, y0), (x0 + w // 2 - 4, y0 + 18), (x0 + 6, y0 + 34),
                  (x0, y0 + 40), (x0 - 6, y0 + 34), (x0 - w // 2 + 4, y0 + 18)], fill=BEARD)
    # Boca abierta y bigote.
    draw.ellipse((x0 - 6, y0 + 4, x0 + 6, y0 + 12), fill=(40, 0, 0))
    draw.line((x0 - 12, y0 + 2, x0 - 1, y0 + 4), fill=FUR, width=4)
    draw.line((x0 + 1, y0 + 4, x0 + 12, y0 + 2), fill=FUR, width=4)
    for dx in (-8, 0, 8):
        draw.line((x0 + dx, y0 + 16, x0 + dx // 2, y0 + 30), fill=BEARD_SHADE, width=2)
    draw.ellipse((x0 - 4, y0 + 22, x0 + 4, y0 + 30), fill=BLOOD)


def draw_side_beard(draw, cx, top, width, side):
    x0 = cx + side * (width // 2 - 6)
    y0 = top + 40
    draw.polygon([(x0 - 8, y0), (x0 + 8, y0), (x0 + side * 4, y0 + 26), (x0 - side * 6, y0 + 18)], fill=BEARD)


def process(cell, direction):
    cell = recolor(cell)
    box = bbox_rows(cell)
    if box is None or box[3] - box[1] < 80:
        return cell  # celda vacia o casi vacia
    top, bottom = box[1], box[3]
    head = head_box(cell, top)
    if head is None:
        return cell
    lo, hi = head
    cx, width = (lo + hi) // 2, hi - lo
    belt_y = draw_belt(cell, top, bottom, cx, int(width * 1.1))
    draw = ImageDraw.Draw(cell)
    if direction in FRONT:
        draw_buckle(draw, cx + FRONT[direction], belt_y)
        draw_beard(draw, cx, top, width, FRONT[direction])
    elif direction in SIDE:
        draw_side_beard(draw, cx, top, width, SIDE[direction])
    lean = -1 if direction in (1, 2, 3) else 1
    draw_hat(draw, cx, top, width, lean)
    return cell


# Bamboleo al caminar: (desplazamiento vertical, giro en grados) por cuadro.
WALK = [(0, -3), (-4, -1.5), (-6, 0), (-4, 1.5), (0, 3), (-2, 0)]


def walk_frame(pose, dy, angle):
    turned = pose.rotate(angle, resample=Image.NEAREST, center=(CELL // 2, CELL - 20))
    frame = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    frame.alpha_composite(turned, (0, max(0, dy)) if dy > 0 else (0, 0), (0, -dy if dy < 0 else 0))
    return frame


def main():
    sheet = Image.open(SRC).convert('RGBA')
    out = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
    for direction in range(COLS):
        pose = process(sheet.crop((direction * CELL, 0, (direction + 1) * CELL, CELL)), direction)
        out.paste(pose, (direction * CELL, 0))
        for i, (dy, angle) in enumerate(WALK):
            out.paste(walk_frame(pose, dy, angle), (i * CELL, (1 + direction) * CELL))
    out.save(DST, optimize=True)
    print('ok', DST, out.size, file=sys.stderr)


if __name__ == '__main__':
    main()
