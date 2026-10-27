import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { pluginDoFavorito } from './src/favorito/construir.ts'
import { CAMINHO } from './src/nucleo/endereco.ts'
import { mudancaDoBuild } from './src/ponte/construir.ts'
import { MANIFESTO } from './manifesto.ts'

// O `base` do build é o caminho do app no endereço publicado. `BASE_ADSUM`
// troca só para ensaio (um build servido noutro caminho).
const base = process.env.BASE_ADSUM ?? CAMINHO

/**
 * Carimbo da build, para os Ajustes poderem responder "esta cópia é a atual?".
 *
 * O service worker serve offline por desenho, e o preço é que uma janela aberta
 * pode continuar mostrando a versão anterior depois de um deploy. Sem um número
 * na tela, "não achei a mudança" não tem como ser investigado — some no meio de
 * cache, PWA instalado e aba antiga.
 */
const CARIMBO = new Date().toISOString().slice(0, 16).replace('T', ' ')

/**
 * O commit da build: o carimbo diz quando, o commit diz qual código. É o que
 * liga o diário de uma aula ao commit que o `npm run verificar` aprovou. No
 * GitHub vem de `GITHUB_SHA`; aqui, do git. Sem nenhum dos dois, fica dito.
 */
function commitDaBuild(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf-8' }).trim()
  } catch {
    return 'sem git'
  }
}
const COMMIT = commitDaBuild()

export default defineConfig(({ command, isPreview }) => ({
  define: {
    __CARIMBO__: JSON.stringify(CARIMBO),
    __COMMIT__: JSON.stringify(COMMIT),
    __MUDANCA__: JSON.stringify(mudancaDoBuild()),
  },
  // Em desenvolvimento o site é a raiz, que é o confortável. No `preview` o
  // `base` volta a valer — sem isso, o preview serve tudo em `/` e passa por
  // bom um build que o Pages serviria quebrado.
  base: command === 'serve' && !isPreview ? '/' : base,
  plugins: [
    react(),
    // Em desenvolvimento o favorito abre este servidor, em ensaio (`?bancada`);
    // no build, o site publicado (`favorito/destino.ts`).
    pluginDoFavorito(
      command === 'serve' && !isPreview
        ? { destino: { origem: 'http://localhost:5173', url: 'http://localhost:5173/?bancada#/sigaa' } }
        : {},
    ),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: MANIFESTO,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Sem cache de rede: o app não fala com servidor nenhum. Se um dia falar,
        // a regra tem que ser network-first — dado de frequência velho é pior que
        // dado ausente.
        runtimeCaching: [],
      },
      devOptions: {
        // Ligado para que a tela de diagnóstico diga a verdade em desenvolvimento.
        enabled: true,
        type: 'module',
      },
    }),
  ],
}))
