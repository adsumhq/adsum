#!/usr/bin/env node
// Três telas em leque, para o topo do README: antes, durante e depois da aula.
//
// Saem da vitrine (`#/vitrine`), que só tem gente inventada, num Chromium
// descartável: os "Presente" tocados aqui gravam na base desse navegador, que
// morre com ele. O vite sobe desta pasta numa porta própria.
//
//   node scripts/gerar_leque.mjs     →  docs/leque.png
//
// Fundo transparente, porque o README é lido no tema claro e no escuro do
// GitHub. As telas ficam no claro, que é o rosto padrão do app.

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SAIDA = fileURLToPath(new URL('../docs/leque.png', import.meta.url))

// Largura da janela de captura: estreita o bastante para a tela ficar em pé,
// que é o que deixa três caberem lado a lado.
const LARGURA = 760

const servidor = await createServer({ root: RAIZ, logLevel: 'error', server: { port: 5199, strictPort: false } })
await servidor.listen()
const endereco = servidor.resolvedUrls.local[0]

// O campo de data segue o idioma do navegador, não o `locale` da página.
const navegador = await chromium.launch({ args: ['--lang=pt-BR'] })
try {
  const pagina = await navegador.newPage({
    viewport: { width: LARGURA, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
  })
  // Uma terça às 10h20, para a imagem não envelhecer com a hora em que foi gerada.
  await pagina.clock.install({ time: new Date('2026-10-20T10:20:00-03:00') })
  await pagina.goto(`${endereco}#/vitrine`)
  await pagina.locator('.cena__topo h2', { hasText: 'SIGAA: há o que lançar' }).waitFor()
  await pagina.waitForTimeout(1500)

  const cena = (titulo) =>
    pagina.locator('section.cena').filter({ has: pagina.locator('.cena__topo h2').getByText(titulo, { exact: true }) })

  // A chamada com nomes entrando: dois "Presente" à mão fazem o que dois
  // crachás fariam na lista de leituras.
  const aula = cena('A aula, turma completa')
  for (let i = 0; i < 2; i++) {
    await aula.getByRole('button', { name: 'Presente', exact: true }).first().click()
    await pagina.waitForTimeout(600)
  }

  const captura = async (titulo) => {
    const tela = cena(titulo).locator('.cena__tela')
    // A moldura da cena é da vitrine, não do app: a janela desenhada abaixo a substitui.
    await tela.evaluate((el) => {
      el.style.boxShadow = 'none'
      el.style.borderRadius = '0'
    })
    return (await tela.screenshot({ type: 'png' })).toString('base64')
  }

  const telas = {
    inicio: await captura('Repouso'),
    chamada: await captura('A aula, turma completa'),
    sigaa: await captura('SIGAA: há o que lançar'),
  }

  const composicao = await navegador.newPage({ viewport: { width: 1500, height: 740 }, deviceScaleFactor: 2 })
  await composicao.setContent(leque(telas))
  await composicao.waitForLoadState('load')
  await composicao.screenshot({ path: SAIDA, omitBackground: true })
  console.log('✓', SAIDA)
} finally {
  await navegador.close()
  await servidor.close()
}

function leque({ inicio, chamada, sigaa }) {
  const janela = (classe, titulo, png) => `
    <div class="sombra ${classe}"><figure class="janela">
      <header><i></i><i></i><i></i><span>${titulo}</span></header>
      <img src="data:image/png;base64,${png}">
    </figure></div>`
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  body { width: 1500px; height: 740px; overflow: hidden; font-family: -apple-system, system-ui, sans-serif; }
  .palco { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; }
  .sombra { filter: drop-shadow(0 0 1px rgba(0, 0, 0, .18)) drop-shadow(0 20px 36px rgba(0, 0, 0, .20)); }
  .janela { margin: 0; overflow: hidden; border-radius: 14px; background: #fff; }
  .janela header {
    display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px;
    background: #f5f5f7; border-bottom: 1px solid #e5e5ea; position: relative;
  }
  .janela header i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; }
  .janela header i:nth-child(2) { background: #febc2e; }
  .janela header i:nth-child(3) { background: #28c840; }
  .janela header span {
    position: absolute; left: 0; right: 0; text-align: center;
    font-size: 12px; font-weight: 500; color: #6e6e73;
  }
  .janela img { display: block; width: 100%; }
  .centro { width: 580px; z-index: 2; }
  .lado { width: 470px; margin-top: 64px; z-index: 1; }
  .esq { transform: rotate(-5deg); margin-right: -40px; }
  .dir { transform: rotate(5deg); margin-left: -40px; }
  /* Recortadas na altura, inteiras: a janela acaba, não se desfaz. */
  .centro .janela { max-height: 624px; }
  .lado .janela { max-height: 560px; }
</style>
<div class="palco">
  ${janela('lado esq', 'Adsum', inicio)}
  ${janela('centro', 'Adsum · IF685 · T01', chamada)}
  ${janela('lado dir', 'Adsum · SIGAA', sigaa)}
</div>`
}
