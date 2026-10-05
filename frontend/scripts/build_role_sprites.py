#!/usr/bin/env python3
import json
from pathlib import Path

from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC = REPO_ROOT / "frontend" / "public"
SIN_FONDO = REPO_ROOT / "imagenes" / "personajes" / "Sin fondo"

ROLES = {
    "biomedica": "BiomedicaOperacionGaravito-removebg-preview.png",
    "economia": "EconomiaOperacionGaravito-removebg-preview.png",
    "infraestructura": "InfraestructuraOperacionGaravito-removebg-preview.png",
    "seguridad": "SeguridadOperacionGaravito-removebg-preview.png",
}

FRAME_BY_DIRECTION = {"down": "down_idle_0", "up": "up_idle_0", "right": "right_0"}


def crop_frame(atlas, frames, name):
    box = frames[name]["frame"]
    return atlas.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))


def build_directional_sprites(role):
    atlas = Image.open(PUBLIC / "sprites" / f"{role}.png").convert("RGBA")
    frames = json.load(open(PUBLIC / "sprites" / f"{role}.json"))["frames"]
    for direction, frame in FRAME_BY_DIRECTION.items():
        crop_frame(atlas, frames, frame).save(PUBLIC / "sprites" / f"{role}_{direction}.png")
    ImageOps.mirror(crop_frame(atlas, frames, "right_0")).save(PUBLIC / "sprites" / f"{role}_left.png")


SHEET_CELLS = {
    "economia": {"down": (0, 0), "up": (1, 0), "right": (1, 3)},
    "infraestructura": {"down": (0, 0), "up": (1, 4), "right": (1, 3)},
}


def build_sprites_from_sheet(role, source):
    sheet = Image.open(SIN_FONDO / source).convert("RGBA")
    cell_w = sheet.width / 8
    cell_h = sheet.height / 4
    for direction, (row, col) in SHEET_CELLS[role].items():
        cell = sheet.crop((round(col * cell_w), round(row * cell_h), round((col + 1) * cell_w), round((row + 1) * cell_h)))
        cell = cell.crop(cell.getbbox())
        cell.save(PUBLIC / "sprites" / f"{role}_{direction}.png")
    right = Image.open(PUBLIC / "sprites" / f"{role}_right.png")
    ImageOps.mirror(right).save(PUBLIC / "sprites" / f"{role}_left.png")


def build_portrait(role, source):
    sheet = Image.open(SIN_FONDO / source).convert("RGBA")
    cell = sheet.crop((0, 0, round(sheet.width / 8), round(sheet.height / 4)))
    portrait = cell.crop(cell.getbbox())
    portrait = portrait.resize((portrait.width * 4, portrait.height * 4), Image.NEAREST)
    out = PUBLIC / "personajes"
    out.mkdir(exist_ok=True)
    portrait.save(out / f"{role}.png")


for role, source in ROLES.items():
    if role in SHEET_CELLS:
        build_sprites_from_sheet(role, source)
    elif role != "seguridad":
        build_directional_sprites(role)
    build_portrait(role, source)
print("listo")
