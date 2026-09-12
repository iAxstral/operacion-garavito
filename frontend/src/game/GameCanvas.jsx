import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MainScene from './MainScene';

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
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scene: [MainScene],
    });

    // Conveniencia de dev: acceso rapido a la instancia de Phaser desde la
    // consola del navegador (debug de camara/escena). No se incluye en build
    // de produccion.
    if (import.meta.env.DEV) {
      window.__phaserGame = gameRef.current;
    }

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} id="game-canvas" />;
}
