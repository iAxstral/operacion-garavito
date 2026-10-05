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
})
