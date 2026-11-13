"""Copia los personajes de 16 direcciones (atlas de Phaser) a public/characters/.

Uso:
    python scripts/build_characters_16dir.py <carpeta characters/ del paquete 16dir>

Por cada personaje copia <nombre>.png y <nombre>.json tal cual y escribe
<nombre>_anims.json con:

- `poses`: por direccion (0 = derecha, sentido horario, cada 22,5°) los cuadros de
  idle, walk y dash como [nombre, espejo]. El paquete original trae algunas poses
  asignadas al lado contrario (p. ej. la pose quieta de "arriba a la derecha" mira
  arriba a la izquierda), asi que se mide hacia donde mira cada cuadro y, si
  contradice su direccion, se marca para dibujarlo espejado.
- `head`: por cuadro full_* la coronilla (relativa a los pies) y el centro de la
  cabeza, para poner los disfraces sobre la cabeza en cualquier pose.
- Gorro de Santa (paquete con `hat_*` en el atlas): cada pose lleva ademas
  [.., gorro, espejoGorro, puntaX, puntaY]: el cuadro del gorro hecho para esa pose y
  la punta (relativa a los pies) donde cuelga el pompon. Si la pose se dibuja en
  espejo se usa el gorro de su cuadro gemelo (el mismo dibujo ya volteado) y, si no
  hay gemelo, el de la direccion reflejada volteado.
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

CHARACTERS = ['cientifica', 'economia', 'infraestructura', 'seguridad']
ALPHA_MIN = 40
# Filas que se promedian para ubicar el centro horizontal de la cabeza.
HEAD_ROWS = 18
# Filas de la cabeza donde se busca piel para saber hacia donde mira.
FACE_ROWS = 30
# Menos de esto (px de diferencia) es "de frente" o "de espaldas": no se corrige.
SIDE_MARGIN = 0.8
DIRECTIONS = 16

# Pose quieta elegida a mano para las diagonales de arriba (lado derecho; el izquierdo
# usa la misma en espejo). El paquete repetia la misma pose en direcciones vecinas
# (p. ej. NNE y NE iguales, ENE igual a E) y al girar hacia arriba casi no cambiaba;
# estas usan las poses de espaldas que ya trae el atlas para que cada paso de 22,5°
# tenga la suya, como hacia abajo. El lado al que miran se corrige solo despues.
IDLE_OVERRIDES = {
    # 13 = NNE, 14 = NE, 15 = ENE
    'seguridad': {13: '31', 14: '26', 15: '10'},
    'cientifica': {14: '23'},
}


def mirror_direction(d):
    """La direccion reflejada de izquierda a derecha (ENE <-> WNW, N y S quedan)."""
    return (8 - d) % DIRECTIONS


def opaque_top(cell):
    w, h = cell.size
    alpha = cell.getchannel('A').load()
    return next((y for y in range(h) if any(alpha[x, y] > ALPHA_MIN for x in range(w))), None)


def head_center_x(cell, top):
    w, h = cell.size
    alpha = cell.getchannel('A').load()
    xs = [x for y in range(top, min(h, top + HEAD_ROWS)) for x in range(w) if alpha[x, y] > ALPHA_MIN]
    return sum(xs) / len(xs)


def is_skin(r, g, b):
    # Piel: rojiza clara. El casco amarillo (azul muy bajo) y el pelo cafe (oscuro) no.
    return r > 150 and g > 105 and b > 75 and r - b > 45 and r > g and g < r * 0.9


def facing_side(cell, top):
    """>0 si la cara (o la oreja, de espaldas) queda a la derecha de la cabeza."""
    w, h = cell.size
    px = cell.load()
    xs, skin = [], []
    for y in range(top, min(h, top + FACE_ROWS)):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_MIN:
                continue
            xs.append(x)
            if is_skin(r, g, b):
                skin.append(x)
    if len(skin) < 8:
        return 0.0
    return sum(skin) / len(skin) - sum(xs) / len(xs)


def expected_side(direction):
    """+1 hacia la derecha, -1 hacia la izquierda, 0 de frente/espaldas (S y N)."""
    if direction in (4, 12):
        return 0
    return 1 if direction < 4 or direction > 12 else -1


def circular_distance(a, b):
    d = abs(a - b) % DIRECTIONS
    return min(d, DIRECTIONS - d)


def hat_frame(frames, ref, target_dir):
    """El cuadro hat_* hecho para la pose `ref`, de la direccion mas cercana a `target_dir`."""
    if ref.startswith('dash'):
        key = f'hat_{ref}'
        return key if key in frames else None
    candidates = []
    for key in frames:
        parts = key.split('_')
        if len(parts) == 3 and parts[0] == 'hat' and parts[1].isdigit() and parts[2] == ref:
            candidates.append((circular_distance(int(parts[1]), target_dir), key))
    return min(candidates)[1] if candidates else None


def mirror_twins(atlas, frames):
    """Por cuadro full_*, otro cuadro full_* que es exactamente su espejo (si existe)."""
    crops = {}
    for key, spec in frames.items():
        if key.startswith('full_'):
            f = spec['frame']
            crops[key] = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    twins = {}
    for key, img in crops.items():
        flipped = ImageOps.mirror(img)
        for other, candidate in crops.items():
            if other != key and candidate.size == flipped.size and not ImageChops.difference(candidate, flipped).getbbox():
                twins[key] = other
                break
    return twins


def resolve_hat(frames, anims, twins, d, frame, mirrored):
    """[gorro, espejo, puntaX, puntaY] para la pose `frame` dibujada en la direccion d."""
    ref = frame[len('full_'):]
    key, flip = None, 0
    if not mirrored:
        key = hat_frame(frames, ref, d)
    else:
        twin = twins.get(frame)
        if twin:
            key = hat_frame(frames, twin[len('full_'):], d)
        if not key:
            key, flip = hat_frame(frames, ref, mirror_direction(d)), 1
    if not key:
        return []
    top = anims.get('hatTop', {}).get(key[len('hat_'):], [0, -anims['footY'] - 8])
    return [key, flip, -top[0] if flip else top[0], top[1]]


def build(src_root, dst_root):
    for name in CHARACTERS:
        src = src_root / name / 'atlas_phaser'
        dst = dst_root / name
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src / f'{name}.png', dst / f'{name}.png')
        shutil.copyfile(src / f'{name}.json', dst / f'{name}.json')

        atlas = Image.open(src / f'{name}.png').convert('RGBA')
        frames = json.loads((src / f'{name}.json').read_text(encoding='utf-8'))['frames']
        anims = json.loads((src / f'{name}_anims.json').read_text(encoding='utf-8'))
        cell_w = anims['cell'][0]

        head, side = {}, {}
        for key, spec in frames.items():
            if not key.startswith('full_'):
                continue
            f = spec['frame']
            cell = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
            top = opaque_top(cell)
            if top is None:
                continue
            head[key] = [round(head_center_x(cell, top) - cell_w / 2, 1), top - anims['footY']]
            side[key] = facing_side(cell, top)

        has_hat = any(key.startswith('hat_') for key in frames)
        twins = mirror_twins(atlas, frames) if has_hat else {}

        for d, ref in IDLE_OVERRIDES.get(name, {}).items():
            anims['dirs'][str(d)]['idle'] = [ref]
            anims['dirs'][str(mirror_direction(d))]['idle'] = [ref]

        poses, flipped = {}, []
        for d in range(DIRECTIONS):
            want = expected_side(d)
            entry = {}
            for anim, refs in anims['dirs'][str(d)].items():
                out = []
                for ref in refs:
                    frame = f'full_{ref}'
                    wrong = want != 0 and side.get(frame, 0) * want < -SIDE_MARGIN
                    pose = [frame, 1 if wrong else 0]
                    if has_hat:
                        pose += resolve_hat(frames, anims, twins, d, frame, wrong)
                    out.append(pose)
                    if wrong:
                        flipped.append(f'{anims["names"][d]}:{anim}:{ref}')
                entry[anim] = out
            poses[str(d)] = entry

        meta = {
            'character': name,
            'names': anims['names'],
            'cell': anims['cell'],
            'footY': anims['footY'],
            'poses': poses,
            'head': head,
        }
        if has_hat:
            meta['hatPad'] = anims.get('hatPad', 0)
        (dst / f'{name}_anims.json').write_text(json.dumps(meta, separators=(',', ':')), encoding='utf-8')
        print(f'{name}: {len(flipped)} cuadros corregidos con espejo -> {" ".join(flipped) or "-"}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build(Path(sys.argv[1]), Path(__file__).resolve().parent.parent / 'public' / 'characters')
