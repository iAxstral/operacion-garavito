import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report', '**/*.tmp.mjs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Configuraciones, scripts y pruebas e2e corren en Node, no en el navegador.
    files: ['*.config.js', 'scripts/**/*.{js,mjs}', 'e2e/**/*.js', 'src/**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
