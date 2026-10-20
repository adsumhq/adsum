import { registerSW } from 'virtual:pwa-register'
import { chamadaViva } from './ambiente/chamadaViva.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilo.css'
import App from './App.tsx'

// Versão nova entra sozinha, e sem pedir licença.
//
// O padrão do plugin registra o service worker e espera todas as abas fecharem
// para trocar de versão — o que significa que uma correção publicada hoje pode
// só aparecer semana que vem, sem ninguém entender por quê. Aqui o service
// worker novo assume assim que chega (`autoUpdate`), e confere de hora em hora
// para quem deixa o app aberto na mesa a manhã inteira.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (registro) setInterval(() => void registro.update(), 60 * 60 * 1000)
  },
  // Quem espera é a recarga da página, não o service worker: em `autoUpdate`
  // ele já assumiu, e o plugin recarregaria na hora se este gancho não
  // existisse (o `onNeedRefresh` de antes nunca era chamado, 20/10/2026). Com
  // chamada aberta, recarregar no meio da fila é perder o crachá que estava
  // chegando. Até lá a página segue com o código dela sob o service worker
  // novo, que só serve o próprio app: o build é um arquivo só.
  onNeedReload() {
    const entrarQuandoPuder = () => {
      if (chamadaViva()) setTimeout(entrarQuandoPuder, 30_000)
      else window.location.reload()
    }
    entrarQuandoPuder()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
