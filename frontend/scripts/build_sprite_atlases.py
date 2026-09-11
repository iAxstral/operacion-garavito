#!/usr/bin/env python3
"""
Convierte laminas de poses (fondo transparente) en atlas Phaser 3
(1 PNG empacado + 1 JSON Hash por personaje), sin TexturePacker.

Uso:
    python3 frontend/scripts/build_sprite_atlases.py

Requiere solo Pillow (pip install Pillow). El labeling de componentes
conectados (para detectar cada pose individual) esta implementado a mano
con flood-fill (BFS), sin numpy/scipy.
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "imagenes" / "personajes" / "Sin fondo"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "sprites"

# Alpha por debajo de este valor se considera fondo. Los bordes
# antialiasados de un remove.bg tipico quedan justo por encima de esto,
# lo que ayuda a que cada pose siga siendo un solo blob con 8-conectividad.
ALPHA_THRESHOLD = 16

# Componentes mas chicos que esto (en px^2) se descartan como ruido del
# recorte de fondo (motas/artefactos), no como poses reales.
MIN_COMPONENT_AREA = 200

# Padding alrededor del bounding box exacto de cada pose, para no cortar
# antialiasing/sombras en el borde.
PADDING = 3

# Si dos poses detectadas se solapan verticalmente, se consideran de la
# misma "fila" al ordenar arriba->abajo, izquierda->derecha.
ROW_OVERLAP_RATIO = 0.4

# Un componente cuyo ancho supera esta proporcion de la mediana de ancho
# (con una altura no proporcionalmente mayor) se trata como dos poses que
# quedaron unidas en el recorte de fondo, y se intenta separar buscando la
# "columna valle" (menor densidad de pixeles no transparentes) dentro de el.
WIDE_OUTLIER_WIDTH_RATIO = 1.4
WIDE_OUTLIER_HEIGHT_RATIO = 1.3

# Al buscar la columna valle, se ignora este porcentaje del ancho del
# componente en cada extremo (para no "encontrar" el valle trivial justo
# en el borde del bounding box).
VALLEY_SEARCH_MARGIN_RATIO = 0.2

CHARACTERS = {
    "biomedica": "BiomedicaOperacionGaravito-removebg-preview.png",
    "economia": "EconomiaOperacionGaravito-removebg-preview.png",
    "infraestructura": "InfraestructuraOperacionGaravito-removebg-preview.png",
    "seguridad": "SeguridadOperacionGaravito-removebg-preview.png",
}


def find_components(mask, width, height):
    """8-connected flood fill sobre una mascara booleana (foreground=True).

    Devuelve una lista de bounding boxes (x0, y0, x1, y1) exclusivos en x1/y1,
    y el area (cantidad de pixeles foreground) de cada componente.
    """
    visited = bytearray(width * height)
    components = []

    for start_idx in range(width * height):
        if not mask[start_idx] or visited[start_idx]:
            continue

        queue = deque([start_idx])
        visited[start_idx] = 1
        min_x = max_x = start_idx % width
        min_y = max_y = start_idx // width
        area = 0

        while queue:
            idx = queue.popleft()
            x = idx % width
            y = idx // width
            area += 1
            if x < min_x:
                min_x = x
            if x > max_x:
                max_x = x
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y

            for dy in (-1, 0, 1):
                ny = y + dy
                if ny < 0 or ny >= height:
                    continue
                row_offset = ny * width
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx = x + dx
                    if nx < 0 or nx >= width:
                        continue
                    nidx = row_offset + nx
                    if mask[nidx] and not visited[nidx]:
                        visited[nidx] = 1
                        queue.append(nidx)

        components.append({
            "bbox": (min_x, min_y, max_x + 1, max_y + 1),
            "area": area,
        })

    return components


def _median(values):
    s = sorted(values)
    return s[len(s) // 2]


def find_valley_column(mask, width, bbox, margin_ratio=VALLEY_SEARCH_MARGIN_RATIO):
    """Busca, dentro de bbox, la columna x con menor cantidad de pixeles
    foreground (la "grieta" entre dos poses que quedaron unidas). Ignora un
    margen en cada extremo para no elegir trivialmente el borde del bbox.

    Devuelve (x_absoluto, densidad_en_esa_columna).
    """
    x0, y0, x1, y1 = bbox
    w = x1 - x0
    margin = max(1, int(w * margin_ratio))
    search_x0 = x0 + margin
    search_x1 = x1 - margin
    if search_x1 <= search_x0:
        search_x0, search_x1 = x0 + 1, x1

    best_x = search_x0
    best_count = None
    for x in range(search_x0, search_x1):
        count = 0
        for y in range(y0, y1):
            if mask[y * width + x]:
                count += 1
        if best_count is None or count < best_count:
            best_count = count
            best_x = x

    return best_x, best_count


def bbox_of_region(mask, width, bbox, x_lo, x_hi):
    """Recalcula el bounding box exacto de los pixeles foreground dentro de
    bbox restringidos a la franja horizontal [x_lo, x_hi). No asume que la
    mitad resultante ocupa todo el rectangulo original.
    """
    x0, y0, x1, y1 = bbox
    x_lo = max(x0, x_lo)
    x_hi = min(x1, x_hi)

    min_x = min_y = max_x = max_y = None
    area = 0
    for y in range(y0, y1):
        row = y * width
        for x in range(x_lo, x_hi):
            if mask[row + x]:
                area += 1
                if min_x is None or x < min_x:
                    min_x = x
                if max_x is None or x > max_x:
                    max_x = x
                if min_y is None or y < min_y:
                    min_y = y
                if max_y is None or y > max_y:
                    max_y = y

    if area == 0:
        return None
    return {"bbox": (min_x, min_y, max_x + 1, max_y + 1), "area": area}


def split_wide_outliers(components, mask, width):
    """Detecta componentes anormalmente anchos (poses que quedaron unidas) y
    los reemplaza por dos componentes, cortando en la columna valle. Los
    componentes que no son outliers se devuelven sin tocar.

    Devuelve (nueva_lista_de_componentes, lista_de_splits_realizados) donde
    cada split trae el bbox original, la columna de corte y los dos bbox
    nuevos, para poder generar un recorte de verificacion visual.
    """
    if len(components) < 3:
        return components, []

    widths = [c["bbox"][2] - c["bbox"][0] for c in components]
    heights = [c["bbox"][3] - c["bbox"][1] for c in components]
    med_w = _median(widths)
    med_h = _median(heights)

    result = []
    splits = []
    for comp in components:
        x0, y0, x1, y1 = comp["bbox"]
        w = x1 - x0
        h = y1 - y0
        is_wide_outlier = (
            w > med_w * WIDE_OUTLIER_WIDTH_RATIO
            and h <= med_h * WIDE_OUTLIER_HEIGHT_RATIO
        )
        if not is_wide_outlier:
            result.append(comp)
            continue

        valley_x, valley_density = find_valley_column(mask, width, comp["bbox"])
        left = bbox_of_region(mask, width, comp["bbox"], x0, valley_x)
        right = bbox_of_region(mask, width, comp["bbox"], valley_x, x1)

        if left is None or right is None:
            # No se pudo separar en dos mitades no vacias: dejar el
            # componente original tal cual en vez de perder la pose.
            result.append(comp)
            continue

        result.append(left)
        result.append(right)
        splits.append({
            "original_bbox": comp["bbox"],
            "valley_x": valley_x,
            "valley_density": valley_density,
            "left_bbox": left["bbox"],
            "right_bbox": right["bbox"],
        })

    return result, splits


def order_reading_direction(components):
    """Ordena arriba->abajo, izquierda->derecha, agrupando en filas por
    solapamiento vertical de bounding boxes (tolera espaciado irregular).
    """
    by_top = sorted(components, key=lambda c: c["bbox"][1])

    rows = []  # cada fila: {"y0": min, "y1": max, "items": [...]}
    for comp in by_top:
        x0, y0, x1, y1 = comp["bbox"]
        placed = False
        for row in rows:
            overlap = min(row["y1"], y1) - max(row["y0"], y0)
            height = min(y1 - y0, row["y1"] - row["y0"])
            if height > 0 and overlap / height >= ROW_OVERLAP_RATIO:
                row["items"].append(comp)
                row["y0"] = min(row["y0"], y0)
                row["y1"] = max(row["y1"], y1)
                placed = True
                break
        if not placed:
            rows.append({"y0": y0, "y1": y1, "items": [comp]})

    rows.sort(key=lambda r: r["y0"])
    ordered = []
    for row in rows:
        row["items"].sort(key=lambda c: c["bbox"][0])
        ordered.extend(row["items"])
    return ordered


# Mapeo confirmado (igual para los 4 personajes) del orden de deteccion
# (arriba->abajo, izquierda->derecha) a nombres de frame con sentido. No hay
# poses de perfil izquierdo en ninguna lamina: 'left' se resuelve en Phaser
# reutilizando 'right_N' con flipX=true (mirroring), no con frames propios.
FRAME_NAMES = (
    [f"down_idle_{i}" for i in range(4)]   # 0-3
    + [f"up_idle_{i}" for i in range(4)]   # 4-7
    + [f"right_{i}" for i in range(8)]     # 8-15
    + [f"down_{i}" for i in range(8)]      # 16-23
    + [f"up_{i}" for i in range(8)]        # 24-31
)


def frame_name_for_index(i, total):
    if total == len(FRAME_NAMES):
        return FRAME_NAMES[i]
    # Conteo distinto al esperado (32): no se puede aplicar el mapeo
    # confirmado con seguridad, se cae de vuelta a nombres genericos.
    return f"frame_{i}"


def crop_with_padding(image, bbox, padding, width, height):
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(width, x1 + padding)
    y1 = min(height, y1 + padding)
    return image.crop((x0, y0, x1, y1))


def pack_grid(crops):
    """Packing simple en grilla: todas las celdas del tamano del crop mas
    grande. No es un bin-packing optimo, pero es predecible y suficiente
    para ~32 poses por personaje.
    """
    n = len(crops)
    if n == 0:
        raise ValueError("No se detectaron poses para empacar")

    cell_w = max(c.width for c in crops)
    cell_h = max(c.height for c in crops)
    cols = 1
    while cols * cols < n:
        cols += 1
    rows = (n + cols - 1) // cols

    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (0, 0, 0, 0))
    frames = {}
    for i, crop in enumerate(crops):
        col = i % cols
        row = i // cols
        x = col * cell_w
        y = row * cell_h
        sheet.paste(crop, (x, y), crop)
        frames[frame_name_for_index(i, n)] = {
            "frame": {"x": x, "y": y, "w": crop.width, "h": crop.height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": crop.width, "h": crop.height},
            "sourceSize": {"w": crop.width, "h": crop.height},
        }

    return sheet, frames


def render_split_debug_crop(image, split, padding, width, height):
    """Recorta la zona del blob original (con margen extra) y dibuja una
    linea vertical en la columna de corte, para verificar visualmente que
    el valle detectado cae en el hueco entre dos poses y no a mitad de una.
    """
    from PIL import ImageDraw

    x0, y0, x1, y1 = split["original_bbox"]
    margin = padding + 10
    cx0 = max(0, x0 - margin)
    cy0 = max(0, y0 - margin)
    cx1 = min(width, x1 + margin)
    cy1 = min(height, y1 + margin)

    crop = image.crop((cx0, cy0, cx1, cy1)).convert("RGBA")
    # Fondo blanco solido para que la linea/roja y la pose se vean claras
    # sobre el canal alfa (el crop original sigue siendo transparente).
    canvas = Image.new("RGBA", crop.size, (255, 255, 255, 255))
    canvas.paste(crop, (0, 0), crop)

    draw = ImageDraw.Draw(canvas)
    line_x = split["valley_x"] - cx0
    draw.line([(line_x, 0), (line_x, canvas.height)], fill=(255, 0, 0, 255), width=1)

    return canvas


CONTACT_SHEET_COLS = 8
CONTACT_SHEET_FONTS = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


def _load_contact_sheet_font(size=18):
    from PIL import ImageFont

    for path in CONTACT_SHEET_FONTS:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def generate_contact_sheet(name, crops, output_dir):
    """Genera una hoja de contacto con cada pose (en el orden final)
    etiquetada con su indice y el nombre de frame asignado (segun
    FRAME_NAMES), para verificar el mapeo direccion/frame."""
    from PIL import ImageDraw

    font = _load_contact_sheet_font()
    label_h = 28
    cell_w = max(c.width for c in crops) + 16
    cell_h = max(c.height for c in crops) + label_h + 8
    cols = min(CONTACT_SHEET_COLS, len(crops))
    rows = (len(crops) + cols - 1) // cols

    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)

    for i, crop in enumerate(crops):
        col = i % cols
        row = i // cols
        cell_x = col * cell_w
        cell_y = row * cell_h

        draw.rectangle(
            [cell_x, cell_y, cell_x + cell_w - 1, cell_y + cell_h - 1],
            outline=(190, 190, 190, 255),
        )

        px = cell_x + (cell_w - crop.width) // 2
        py = cell_y + label_h + (cell_h - label_h - crop.height) // 2
        sheet.paste(crop, (px, py), crop)

        label = f"{i} {frame_name_for_index(i, len(crops))}"
        draw.rectangle([cell_x + 2, cell_y + 2, cell_x + cell_w - 3, cell_y + label_h - 2], fill=(200, 0, 0, 255))
        draw.text((cell_x + 6, cell_y + 4), label, fill=(255, 255, 255, 255), font=font)

    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{name}_contact_sheet.png"
    sheet.save(path)
    return path


def build_atlas(name, source_path):
    image = Image.open(source_path).convert("RGBA")
    width, height = image.size
    alpha = image.split()[-1]
    alpha_bytes = alpha.tobytes()
    mask = bytearray(1 if b >= ALPHA_THRESHOLD else 0 for b in alpha_bytes)

    raw_components = find_components(mask, width, height)
    components = [c for c in raw_components if c["area"] >= MIN_COMPONENT_AREA]
    dropped = len(raw_components) - len(components)

    components, splits = split_wide_outliers(components, mask, width)

    debug_crops = []
    for split in splits:
        debug_crops.append(
            render_split_debug_crop(image, split, PADDING, width, height)
        )

    ordered = order_reading_direction(components)
    crops = [
        crop_with_padding(image, c["bbox"], PADDING, width, height)
        for c in ordered
    ]

    contact_sheet_dir = REPO_ROOT / "frontend" / "scripts" / "_contact_sheets"
    contact_sheet_path = generate_contact_sheet(name, crops, contact_sheet_dir)

    sheet, frames = pack_grid(crops)

    atlas_json = {
        "frames": frames,
        "meta": {
            "app": "build_sprite_atlases.py",
            "image": f"{name}.png",
            "size": {"w": sheet.width, "h": sheet.height},
            "scale": "1",
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUTPUT_DIR / f"{name}.png"
    json_path = OUTPUT_DIR / f"{name}.json"
    sheet.save(png_path)
    json_path.write_text(json.dumps(atlas_json, indent=2), encoding="utf-8")

    debug_paths = []
    if debug_crops:
        debug_dir = REPO_ROOT / "frontend" / "scripts" / "_debug_splits"
        debug_dir.mkdir(parents=True, exist_ok=True)
        for i, crop in enumerate(debug_crops):
            debug_path = debug_dir / f"{name}_split_{i}.png"
            crop.save(debug_path)
            debug_paths.append(str(debug_path.relative_to(REPO_ROOT)))

    return {
        "poses_detectadas": len(components),
        "componentes_descartados_por_ruido": dropped,
        "splits_realizados": splits,
        "debug_split_images": debug_paths,
        "atlas_png": str(png_path.relative_to(REPO_ROOT)),
        "atlas_json": str(json_path.relative_to(REPO_ROOT)),
        "atlas_size": sheet.size,
        "bboxes": [c["bbox"] for c in ordered],
        "contact_sheet": str(contact_sheet_path.relative_to(REPO_ROOT)),
    }


def main():
    if not SOURCE_DIR.exists():
        print(f"No existe la carpeta de origen: {SOURCE_DIR}", file=sys.stderr)
        sys.exit(1)

    results = {}
    for name, filename in CHARACTERS.items():
        source_path = SOURCE_DIR / filename
        if not source_path.exists():
            print(f"[{name}] AVISO: no se encontro {source_path}", file=sys.stderr)
            continue
        results[name] = build_atlas(name, source_path)

    print("\n=== Resumen de deteccion de poses ===")
    for name, info in results.items():
        print(
            f"{name:16s} -> {info['poses_detectadas']:2d} poses "
            f"(descartados por ruido: {info['componentes_descartados_por_ruido']}, "
            f"blobs separados por valle: {len(info['splits_realizados'])}), "
            f"atlas {info['atlas_size'][0]}x{info['atlas_size'][1]} "
            f"-> {info['atlas_png']} | hoja de contacto: {info['contact_sheet']}"
        )
        for split, debug_path in zip(info["splits_realizados"], info["debug_split_images"]):
            print(
                f"    split en x={split['valley_x']} (densidad={split['valley_density']}): "
                f"bbox original {split['original_bbox']} -> "
                f"izq {split['left_bbox']} / der {split['right_bbox']} "
                f"| verificacion visual: {debug_path}"
            )

    return results


if __name__ == "__main__":
    main()
