import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
//import IntroScene from "./IntroScene";
import MainScene from './MainScene';

export default function GameCanvas() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return undefined;

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

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} id="game-canvas" />;
}
