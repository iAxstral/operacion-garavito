"""Genera los snacks de Navidad en pixel art (frontend/public/economia/navidad_*.png).

Cada uno es un mapa de 18 x 18 (un caracter = un pixel) que se agranda x4 sin suavizar,
del mismo tamano que los iconos de 72 px de la cafeteria.

Uso: python3 tools/sprites/comidas_navidad.py (desde la raiz del repo).
"""
from PIL import Image

OUT = 'frontend/public/economia/navidad_{}.png'
SCALE = 4

PALETTE = {
    'k': (26, 14, 8),      # contorno
    'o': (214, 140, 52),   # dorado del bunuelo
    'O': (160, 92, 30),    # dorado en sombra
    'l': (246, 196, 102),  # brillo
    'z': (250, 246, 236),  # azucar / glaseado
    'n': (196, 132, 70),   # natilla
    'N': (140, 86, 40),    # natilla en sombra
    'c': (122, 70, 30),    # canela
    'p': (226, 222, 214),  # plato
    'P': (170, 166, 160),  # plato en sombra
    'm': (168, 22, 30),    # taza roja
    'M': (104, 12, 18),    # taza en sombra
    'h': (82, 44, 20),     # chocolate
    'H': (58, 30, 12),
    'v': (220, 220, 230),  # vapor
    'y': (240, 214, 120),  # queso
    'g': (176, 104, 50),   # galleta de jengibre
    'G': (124, 70, 30),
    'r': (210, 30, 40),    # botones rojos
    'e': (30, 110, 50),    # verde
}

BUNUELO = [
    '..................',
    '.......kkkk.......',
    '.....kkollokk.....',
    '....kolllloook....',
    '...kollzlloooOk...',
    '...koolloooozOk...',
    '..kooloooooooOOk..',
    '..koozoooooOoOOk..',
    '..koooooozoooOOk..',
    '..kooooooooOoOOk..',
    '..kOoooooOoooOOk..',
    '...kOoozooooOOk...',
    '...kOOoooooOOOk...',
    '....kOOOOOOOOk....',
    '.....kkOOOOkk.....',
    '.......kkkk.......',
    '..................',
    '..................',
]

NATILLA = [
    '..................',
    '..................',
    '..................',
    '.....kkkkkkkk.....',
    '....knncnnnncnk...',
    '...knnnnncnnnnNk..',
    '...knncnnnnnncNk..',
    '...knnnnnnnnnnNk..',
    '...kNNNNNNNNNNNk..',
    '...kNNNNNNNNNNNk..',
    '..kkkkkkkkkkkkkkk.',
    '.kppppppppppppppPk',
    '..kPPPPPPPPPPPPPk.',
    '...kkkkkkkkkkkkk..',
    '..................',
    '..................',
    '..................',
    '..................',
]

CHOCOLATE = [
    '.....v....v.......',
    '......v....v......',
    '......v....v......',
    '.....v....v.......',
    '...kkkkkkkkkkk....',
    '..khhHhhhyyhhhk...',
    '..kmmmmmmmmmmMkkk.',
    '..kmmzzmmmmmmMk.k.',
    '..kmmmmmmmmmmMk.k.',
    '..kmmmmmmmmmmMk.k.',
    '..kmmmmmmmmmmMkkk.',
    '..kmmmmmmmmmmMk...',
    '...kMMMMMMMMMk....',
    '..kkkkkkkkkkkkk...',
    '..kpppppppppppk...',
    '...kkkkkkkkkkk....',
    '..................',
    '..................',
]

GALLETA = [
    '.......kkkk.......',
    '......kggggk......',
    '.....kgzggzgk.....',
    '.....kggggggk.....',
    '.....kgzzzzgk.....',
    '..kkkkkggggkkkkk..',
    '.kgggggggggggggGk.',
    '.kzgzggggrgggzgGk.',
    '..kkkkkgggggkkkk..',
    '......kggrggk.....',
    '......kgggggk.....',
    '.....kggggggGk....',
    '.....kggkkggGk....',
    '....kggk..kggGk...',
    '....kzgk..kgzGk...',
    '....kkk....kkk....',
    '..................',
    '..................',
]

ESTRELLA = [
    '..................',
    '........kk........',
    '.......kggk.......',
    '.......kggk.......',
    '......kgzzgk......',
    '.kkkkkkggggkkkkkk.',
    '.kgggzggggggzgggk.',
    '..kggggerrggggGk..',
    '...kgggeeeegggk...',
    '....kgggrrgggk....',
    '....kgggggggGk....',
    '...kggzgkkgzgGk...',
    '...kggGk..kgGGk...',
    '..kgGGk....kGGk...',
    '..kkkk......kkk...',
    '..................',
    '..................',
    '..................',
]

ITEMS = {
    'bunuelo': BUNUELO,
    'natilla': NATILLA,
    'chocolate': CHOCOLATE,
    'galleta': GALLETA,
    'estrella': ESTRELLA,
}


def render(rows):
    assert all(len(r) == 18 for r in rows) and len(rows) == 18, 'cada mapa es de 18 x 18'
    img = Image.new('RGBA', (18, 18), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in PALETTE:
                img.putpixel((x, y), PALETTE[ch] + (255,))
    return img.resize((18 * SCALE, 18 * SCALE), Image.NEAREST)


def main():
    for name, rows in ITEMS.items():
        render(rows).save(OUT.format(name), optimize=True)
        print('ok', OUT.format(name))


if __name__ == '__main__':
    main()
