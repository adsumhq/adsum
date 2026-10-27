// A ponte do endereço antigo (`TelaPonte.tsx`, `docs/14_casa_nova.md`).
//
// Registra um service worker de verdade no mesmo `sw.js` do app: é assim que
// o app instalado e a aba esquecida aberta trocam o Adsum antigo pela ponte,
// em vez de ficarem presos na versão do cache.

import { registerSW } from 'virtual:pwa-register'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RepositorioDexie } from '../adaptadores/repositorio/RepositorioDexie.ts'
import '../estilo.css'
import { TelaPonte } from './TelaPonte.tsx'

registerSW({ immediate: true })

let base: Promise<RepositorioDexie> | undefined
const abrirRepositorio = () =>
  (base ??= (async () => {
    const repositorio = new RepositorioDexie()
    await repositorio.abrir()
    return repositorio
  })())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app">
      <TelaPonte abrirRepositorio={abrirRepositorio} />
    </div>
  </StrictMode>,
)
