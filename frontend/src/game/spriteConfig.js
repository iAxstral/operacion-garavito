/**
 * Single place to swap the placeholder character for a real cropped
 * spritesheet once one is available (e.g. exported from Aseprite/Piskel/
 * TexturePacker with `FRAMES_PER_DIRECTION` equal-size frames per row).
 *
 * The real sheet's frames must be numbered row-major (row 0 = ROW_ORDER[0],
 * left-to-right), which is exactly how Phaser numbers `load.spritesheet`
 * frames and how MainScene's placeholder generator numbers its frames too —
 * so no animation code needs to change, only the values below.
 */
export const USE_REAL_SPRITESHEET = false;

export const SEGURIDAD_SPRITE = {
  key: 'seguridad',
  // Real asset (JPEG references in /imagenes are concept art, not a cropped
  // grid). Once cropped to a transparent PNG grid, drop it here and flip
  // USE_REAL_SPRITESHEET above to true.
  path: '/sprites/seguridad.png',
  frameWidth: 32,
  frameHeight: 48,
  framesPerDirection: 4,
  // Row index per direction inside the sheet. Adjust to match the real sheet.
  rowOrder: ['down', 'up', 'left', 'right'],
  color: 0x2d5f8a,
};
