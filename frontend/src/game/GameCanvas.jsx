import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
//import IntroScene from "./IntroScene";
import MainScene from './MainScene';

export default function GameCanvas() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return undefined;
    let cancelled = false;

    const create = () => {
      if (cancelled || gameRef.current) return;
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,

        scale: {
          mode: Phaser.Scale.RESIZE,
          width: '100%',
          height: '100%',
        },
        pixelArt: true,
        physics: {
          default: 'arcade',
          arcade: { debug: false },
        },
        scene: [MainScene],
      });

      if (import.meta.env.DEV) {
        window.__phaserGame = gameRef.current;
      }
    };

    // Phaser dibuja los textos en canvas: la letra gotica tiene que estar cargada antes
    // (si falla o tarda, se sigue con la de respaldo).
    const fonts = document.fonts
      ? Promise.all(['16px "Pirata One"', '16px "Creepster"'].map((font) => document.fonts.load(font)))
      : Promise.resolve();
    Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 1500))]).catch(() => {}).finally(create);

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} id="game-canvas" />;
}
