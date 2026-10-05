#!/usr/bin/env python3
"""
Convierte las 4 fotos nuevas del personaje de Seguridad (de frente, de
espaldas, de lado y del otro lado — cada una una UNICA pose estatica, no un
ciclo de caminata) en 4 texturas transparentes listas para Phaser, una por
direccion.

Reemplaza el intento anterior de armar un ciclo de caminata auto-detectando
poses dentro de una sola lamina de referencia (build_sprite_atlases.py): esa
lamina mezclaba distintos angulos dentro de un mismo ciclo, lo que se veia
como si el personaje "diera vueltas" al caminar. Con una pose fija por
direccion ese problema desaparece por construccion: no hay ciclo, solo un
cambio de textura al girar.

Uso:
    python3 frontend/scripts/build_seguridad_static_sprites.py

Requiere solo Pillow (pip install Pillow).
"""
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "imagenes" / "personajes" / "Con fondo"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "sprites"

# Color de fondo solido de las 4 fotos nuevas (no vienen con transparencia).
BACKGROUND_RGB = (20, 22, 24)
# Distancia de color (suma de |dR|+|dG|+|dB|) para considerar un pixel fondo.
BACKGROUND_THRESHOLD = 40

PADDING = 4

# Direccion (en el juego) <- archivo fuente. La correspondencia lado/direccion
# se confirmo comparando el centro de masa de la cabeza contra el del torso
# en cada foto (la nariz corre la cabeza hacia el lado que mira el personaje).
DIRECTION_FILES = {
    "down": "SeguridadDeFrente.png",   # mirando a camara
    "up": "SeguridadDeEspaldas.png",   # de espaldas
    "right": "SeguridadDeLado.png",
    "left": "SeguridadDelOtroLado.png",
}

# Alto final del sprite en el juego (px). El sprite anterior (atlas
# auto-detectado) quedaba en 129px de alto — se mantiene esa escala para no
# tener que retocar el tamano de la caja de colision ni el paso por puertas.
TARGET_HEIGHT = 132


def remove_background(image):
    """Flood-fill desde el borde: solo el fondo CONECTADO al borde se vuelve
    transparente, para no perforar zonas oscuras internas (pelo, botas) que
    por color quedarian cerca del umbral."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()

    def is_bg(rgba):
        r, g, b = rgba[0], rgba[1], rgba[2]
        return (abs(r - BACKGROUND_RGB[0]) + abs(g - BACKGROUND_RGB[1]) + abs(b - BACKGROUND_RGB[2])) <= BACKGROUND_THRESHOLD

    visited = bytearray(width * height)
    stack = []

    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
        idx = y * width + x
        if visited[idx]:
            continue
        visited[idx] = 1
        if not is_bg(pixels[x, y]):
            continue
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return image


def content_bbox(image):
    alpha = image.split()[-1]
    return alpha.getbbox()


def crop_with_padding(image, bbox, padding):
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(image.width, x1 + padding)
    y1 = min(image.height, y1 + padding)
    return image.crop((x0, y0, x1, y1))


def anchor_to_shared_canvas(crops):
    """Mismo criterio que build_sprite_atlases.py: todas las poses en un
    lienzo del mismo tamano (el mas grande de las 4), centradas
    horizontalmente y con los pies pegados al borde inferior — asi cambiar de
    textura al girar no corre al personaje de lugar."""
    canvas_w = max(c.width for c in crops)
    canvas_h = max(c.height for c in crops)

    anchored = []
    for crop in crops:
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        paste_x = (canvas_w - crop.width) // 2
        paste_y = canvas_h - crop.height
        canvas.paste(crop, (paste_x, paste_y), crop)
        anchored.append(canvas)
    return anchored


def main():
    if not SOURCE_DIR.exists():
        print(f"No existe la carpeta de origen: {SOURCE_DIR}", file=sys.stderr)
        sys.exit(1)

    cutouts = {}
    for direction, filename in DIRECTION_FILES.items():
        source_path = SOURCE_DIR / filename
        if not source_path.exists():
            print(f"AVISO: no se encontro {source_path}", file=sys.stderr)
            continue

        image = remove_background(Image.open(source_path))
        bbox = content_bbox(image)
        if bbox is None:
            print(f"AVISO: {filename} quedo completamente transparente", file=sys.stderr)
            continue
        cutouts[direction] = crop_with_padding(image, bbox, PADDING)

    if len(cutouts) != len(DIRECTION_FILES):
        print("Faltan direcciones, no se genera nada para no dejar el set incompleto.", file=sys.stderr)
        sys.exit(1)

    directions = list(DIRECTION_FILES.keys())
    anchored = anchor_to_shared_canvas([cutouts[d] for d in directions])

    scale = TARGET_HEIGHT / anchored[0].height
    target_size = (round(anchored[0].width * scale), TARGET_HEIGHT)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for direction, canvas in zip(directions, anchored):
        resized = canvas.resize(target_size, Image.LANCZOS)
        out_path = OUTPUT_DIR / f"seguridad_{direction}.png"
        resized.save(out_path)
        print(f"{direction:6s} -> {out_path.relative_to(REPO_ROOT)} ({resized.width}x{resized.height})")


if __name__ == "__main__":
    main()
