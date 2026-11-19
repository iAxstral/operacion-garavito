import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // sockjs-client references the Node global `global`, which the browser
  // and Vite's dev/build pipeline don't provide.
  define: {
    global: 'globalThis',
  },
  build: {
    // Phaser solo pesa ~1.4 MB y ya va en su propio chunk (se carga al entrar a la partida).
    chunkSizeWarningLimit: 1600,
  },
})
