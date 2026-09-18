import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MainScene from './MainScene';

export default function GameCanvas() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return undefined;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      // RESIZE (no un ancho/alto fijo): el canvas ocupa exactamente lo que
      // mida su contenedor, que a su vez llena el viewport via CSS (ver
      // App.css) — asi la resolucion se ajusta a cualquier pantalla sin
      // dejar bordes negros ni recortar el juego dentro de un recuadro fijo.
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
