import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

import MainScene from './MainScene';
import HudScene from './ui/HudScene';

/**
 * Viewport size. The world itself is much larger (see world/campus.js) and the
 * camera follows the player across it — that gap is what stops the zone from
 * reading as a static board.
 */
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

export default function GameCanvas() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return undefined;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      pixelArt: true,
      backgroundColor: '#0d1117',
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      // HudScene is listed but not auto-started: MainScene launches it once it
      // has a bus and a game state to hand over.
      scene: [MainScene, HudScene],
    });

    // Dev-only handle for poking at the running game from the console or from
    // an automated smoke test. Stripped from production builds.
    if (import.meta.env.DEV) window.__garavito = gameRef.current;

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      if (import.meta.env.DEV) delete window.__garavito;
    };
  }, []);

  return <div ref={containerRef} id="game-canvas" />;
}
