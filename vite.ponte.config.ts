// O build da ponte, que fica no endereço antigo depois da mudança
// (`docs/14_casa_nova.md`): `npm run build:ponte`, em `dist-ponte/`.
//
// Mesmo `sw.js` e mesmo manifesto do app, no mesmo caminho: o service worker
// do app antigo encontra um `sw.js` novo, troca de versão como numa
// atualização qualquer, e a próxima abertura já é a ponte.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { MANIFESTO } from './manifesto.ts'
import { mudancaDoBuild } from './src/ponte/construir.ts'

const mudanca = mudancaDoBuild()

export default defineConfig({
  root: 'ponte',
  publicDir: '../public',
  base: process.env.BASE_ADSUM ?? mudanca.de.caminho,
  define: { __MUDANCA__: JSON.stringify(mudanca) },
  build: { outDir: '../dist-ponte', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: MANIFESTO,
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'], runtimeCaching: [] },
    }),
  ],
})
