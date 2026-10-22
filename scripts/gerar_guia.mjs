#!/usr/bin/env node
// Guia de uso do Adsum, em PDF: o passo a passo com as telas, para o professor
// aprender e para quem decide entender o que está aprovando.
//
// As telas do Adsum saem da vitrine (`#/vitrine`), só com gente inventada, num
// Chromium descartável, como o leque do README. As do SIGAA saem da bancada: a
// planilha de verdade, anonimizada, com os scripts do próprio SIGAA, e o
// favorito e o Preencher rodando nela como rodam na sala. Por isso o guia
// precisa da bancada (`ADSUM_BANCADA`, fora do repositório) e recusa sair sem ela.
//
//   node scripts/gerar_guia.mjs     →  docs/Adsum-guia.pdf
//
// O texto mora aqui, junto do código que ele descreve. Mudou uma tela, roda de
// novo; o PDF nunca é editado à mão.

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SAIDA = fileURLToPath(new URL('../docs/Adsum-guia.pdf', import.meta.url))
const ICONE = readFileSync(new URL('../public/icone-512.png', import.meta.url)).toString('base64')
const ENDERECO_DO_SITE = 'willianrupert.github.io/adsum'

const BANCADA = [process.env.ADSUM_BANCADA, '../Adsum_bancada_sigaa', '../Adsum/fora-do-git/bancada-sigaa']
  .filter(Boolean)
  .map((pasta) => resolve(RAIZ, pasta))
  .find((pasta) => existsSync(join(pasta, 'planilha.html')))
if (!BANCADA) {
  console.error('Sem a bancada do SIGAA (ADSUM_BANCADA). O guia não sai com a planilha desenhada no lugar da de verdade.')
  process.exit(1)
}

// A bancada só aceita o Adsum vindo da 5173 (`ORIGEM_DO_ADSUM`).
const servidor = await createServer({ root: RAIZ, logLevel: 'error', server: { port: 5173, strictPort: true } })
await servidor.listen()
const endereco = servidor.resolvedUrls.local[0]
const bancada = spawn(process.execPath, [join(RAIZ, 'scripts/bancada_sigaa.mjs'), BANCADA], { stdio: 'ignore' })
for (let i = 0; i < 50; i++) {
  if (await fetch('http://localhost:8080/bancada/registros').then((r) => r.ok, () => false)) break
  await new Promise((r) => setTimeout(r, 200))
}

const navegador = await chromium.launch({ args: ['--lang=pt-BR'] })
try {
  const telas = { ...(await capturar(navegador)), ...(await capturarSigaa(navegador)) }
  const html = guia(telas)
  const pagina = await navegador.newPage({ locale: 'pt-BR' })
  await pagina.setContent(html)
  await pagina.waitForLoadState('load')
  await pagina.pdf({ path: SAIDA, format: 'A4', printBackground: true, preferCSSPageSize: true })
  console.log('✓', SAIDA)
} finally {
  await navegador.close()
  await servidor.close()
  bancada.kill()
}

async function capturar(navegador) {
  const pagina = await navegador.newPage({
    viewport: { width: 760, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
  })
  // Uma terça às 10h20, para o guia não envelhecer com a hora em que foi gerado.
  await pagina.clock.install({ time: new Date('2026-10-20T10:20:00-03:00') })
  await pagina.goto(`${endereco}#/vitrine`)
  await pagina.locator('.cena__topo h2', { hasText: 'SIGAA: há o que lançar' }).waitFor()
  await pagina.waitForTimeout(1500)

  const cena = (titulo) =>
    pagina.locator('section.cena').filter({ has: pagina.locator('.cena__topo h2').getByText(titulo, { exact: true }) })

  const foto = async (alvo) => {
    await alvo.evaluate((el) => {
      el.style.boxShadow = 'none'
      el.style.borderRadius = '0'
    })
    return (await alvo.screenshot({ type: 'png' })).toString('base64')
  }
  const tela = (titulo) => foto(cena(titulo).locator('.cena__tela'))

  const telas = {}
  telas.pasta = await tela('Escolha onde guardar')
  telas.turma = await tela('A turma')
  telas.cronograma = await tela('O cronograma')
  telas.repouso = await tela('Repouso')
  telas.pendentes = await tela('A aula, com gente pendente')
  telas.busca = await tela('Crachá novo')

  // Dois "Presente" à mão fazem o que dois crachás fariam na lista de leituras.
  const aula = cena('A aula, turma completa')
  for (let i = 0; i < 2; i++) {
    await aula.getByRole('button', { name: 'Presente', exact: true }).first().click()
    await pagina.waitForTimeout(600)
  }
  telas.chamada = await tela('A aula, turma completa')
  telas.fim = await tela('Fim da aula')
  telas.planilha = await tela('A planilha do curso')

  // Os dois cartões moram nos Ajustes, que a vitrine monta com a base deste
  // Chromium descartável: vazia, e morre com ele.
  const base = cena('Base')
  for (const nome of ['O leitor de crachá', 'Lançar no SIGAA']) {
    const painel = base.getByRole('button', { name: new RegExp(nome) }).first()
    if (await painel.count()) await painel.click().catch(() => {})
  }
  await pagina.waitForTimeout(400)
  telas.leitor = await foto(base.locator('.cartao--leitor').first())
  telas.favorito = await foto(base.locator('.favorito').first())
  return telas
}

/**
 * O caminho do SIGAA como o professor o vê: a planilha, o favorito, a janela
 * do Adsum, o Preencher, a barra, o Gravar e a conferência final. O botão
 * "Favorito (ensaio)" é da bancada, no lugar do favorito da barra, e sai da foto.
 */
async function capturarSigaa(navegador) {
  const contexto = await navegador.newContext({ viewport: { width: 1640, height: 860 }, deviceScaleFactor: 2, locale: 'pt-BR', colorScheme: 'light' })
  const planilha = await contexto.newPage()
  await fetch('http://localhost:8080/bancada/reiniciar', { method: 'POST' })
  await planilha.goto('http://localhost:8080')
  await planilha.waitForLoadState('load')
  await planilha.locator('#planilha td').first().waitFor()
  await planilha.waitForTimeout(800)
  // A página é mais larga que a janela e centrada à direita: recorta-se a planilha.
  const recorte = await planilha.evaluate(() => {
    const caixa = document.querySelector('fieldset').getBoundingClientRect()
    return { x: Math.max(0, caixa.x - 10), y: 0, width: Math.min(1260, caixa.width + 20), height: 860 }
  })
  // Preenchida, a foto começa no título da planilha, para caber a barra do pé.
  const fotoDaPlanilha = async (desdeATabela = false) => {
    await planilha.locator('#bancada-favorito').evaluate((el) => (el.style.visibility = 'hidden'))
    let clip = recorte
    if (desdeATabela) {
      const topo = await planilha.evaluate(() => document.querySelector('#planilha').getBoundingClientRect().y - 40)
      clip = { ...recorte, y: topo, height: recorte.height - topo }
    }
    const png = (await planilha.screenshot({ clip })).toString('base64')
    await planilha.locator('#bancada-favorito').evaluate((el) => (el.style.visibility = ''))
    return png
  }
  const abrirJanela = async () => {
    const [janela] = await Promise.all([planilha.waitForEvent('popup'), planilha.locator('#bancada-favorito').click()])
    await janela.getByRole('heading', { level: 1 }).filter({ hasNotText: 'Lendo a planilha' }).waitFor({ timeout: 15_000 })
    await janela.waitForTimeout(600)
    return janela
  }

  const telas = {}
  telas.sigaaPlanilha = await fotoDaPlanilha()
  const janela = await abrirJanela()
  telas.sigaaJanela = (await janela.screenshot({ fullPage: true })).toString('base64')
  await Promise.all([janela.waitForEvent('close'), janela.getByRole('button', { name: /^Preencher \d+ aulas?$/ }).click()])
  await planilha.locator('[data-adsum="barra"]').waitFor()
  await planilha.waitForTimeout(600)
  telas.sigaaPreenchida = await fotoDaPlanilha(true)
  await Promise.all([planilha.waitForURL(/gravado=/), planilha.getByRole('button', { name: 'Gravar Frequências' }).click()])
  await planilha.waitForLoadState('load')
  await planilha.locator('#planilha td').first().waitFor()
  await planilha.waitForTimeout(800)
  const final = await abrirJanela()
  telas.sigaaConfere = (await final.screenshot({ fullPage: true })).toString('base64')
  await contexto.close()
  return telas
}

function guia(t) {
  const img = (png, classe = '') => `<img class="${classe}" src="data:image/png;base64,${png}">`
  const janela = (png, titulo = 'Adsum', classe = '') => `
    <figure class="janela ${classe}">
      <header><i></i><i></i><i></i><span>${titulo}</span></header>
      ${img(png)}
    </figure>`
  const passo = (n, titulo, texto, figura, classe = '') => `
    <section class="passo ${classe}">
      <div class="passo__texto">
        <span class="passo__n">${n}</span>
        <h3>${titulo}</h3>
        ${texto}
      </div>
      <div class="passo__figura">${figura}</div>
    </section>`
  const dica = (texto) => `<p class="dica">${texto}</p>`
  // A moldura do Chrome é desenho; o que está dentro dela é a página de verdade.
  const chrome = (png, aba, endereco, classe = '') => `
    <figure class="chrome ${classe}">
      <div class="chrome__abas"><i></i><i></i><i></i><span class="chrome__aba">${aba}</span></div>
      <div class="chrome__endereco"><span>${endereco}</span></div>
      <div class="chrome__favoritos"><span>Favoritos</span><span class="chrome__adsum">Adsum</span></div>
      ${img(png)}
    </figure>`

  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Adsum: guia de uso</title>
<style>
  @page { size: A4; margin: 0; }
  :root {
    --tinta: #1d1d1f; --fraca: #6e6e73; --tenue: #86868b; --fundo-alt: #f5f5f7;
    --acao: #0071e3; --acao-fraca: #e8f2fd; --alerta: #bf6516; --alerta-fraca: #fdf1e5;
    --separador: #d2d2d7; --verde: #34c759;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: var(--tinta);
    font-family: -apple-system, 'SF Pro Text', system-ui, 'Helvetica Neue', sans-serif;
    font-size: 10.5pt; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  .folha { width: 210mm; height: 297mm; padding: 18mm 18mm 16mm; position: relative;
    page-break-after: always; overflow: hidden; display: flex; flex-direction: column; }
  .folha:last-child { page-break-after: auto; }
  .rodape { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; display: flex;
    justify-content: space-between; font-size: 8pt; color: var(--tenue); }
  h1, h2, h3 { font-family: -apple-system, 'SF Pro Display', system-ui, sans-serif; margin: 0; letter-spacing: -0.02em; }
  h2 { font-size: 24pt; font-weight: 700; line-height: 1.1; margin-bottom: 3mm; }
  h3 { font-size: 13pt; font-weight: 600; margin: 1.5mm 0 1.5mm; letter-spacing: -0.01em; }
  p { margin: 0 0 2.2mm; }
  .lead { font-size: 12.5pt; color: var(--fraca); line-height: 1.4; margin-bottom: 7mm; max-width: 150mm; }
  .sobretitulo { font-size: 9pt; font-weight: 600; color: var(--acao); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2mm; }
  kbd, .mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 9pt;
    background: var(--fundo-alt); border-radius: 4px; padding: 0 1.2mm; }
  b { font-weight: 600; }

  /* Capa */
  .capa { justify-content: space-between; padding-top: 34mm; }
  .capa .icone { width: 30mm; height: 30mm; border-radius: 7mm; box-shadow: 0 4mm 10mm rgba(0,0,0,.12); }
  .capa h1 { font-size: 46pt; font-weight: 700; letter-spacing: -0.035em; margin: 10mm 0 3mm; }
  .capa .lead { font-size: 17pt; max-width: 150mm; color: var(--fraca); }
  .capa .leque { margin: 0 -18mm; display: flex; justify-content: center; align-items: flex-start; gap: 0; }
  .capa .leque .janela { width: 64mm; }
  .capa .leque .janela img { max-height: 98mm; object-fit: cover; object-position: top; }
  .capa .leque .meio { width: 76mm; z-index: 2; margin: 0 -8mm; }
  .capa .leque .esq { transform: rotate(-4deg); margin-top: 10mm; }
  .capa .leque .dir { transform: rotate(4deg); margin-top: 10mm; }
  .capa .pe { display: flex; justify-content: space-between; align-items: center; font-size: 9.5pt; color: var(--fraca); }
  .capa .pe b { color: var(--tinta); }
  /* O cartão de créditos da tela inicial do app (Creditos.tsx), sem a seta. */
  .creditos { display: flex; flex-direction: column; align-items: center; gap: .5mm; text-align: center;
    background: var(--fundo-alt); border-radius: 4.5mm; padding: 3.4mm 9mm; color: var(--tinta); }
  .creditos__rotulo { font-size: 8pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--fraca); }
  .creditos__nomes { font-size: 11.5pt; font-weight: 600; }
  .creditos__e { font-weight: 400; color: var(--fraca); }
  .creditos__onde { font-size: 8.5pt; color: var(--fraca); }

  /* Janela de app desenhada em volta da captura */
  .janela { margin: 0; overflow: hidden; border-radius: 3mm; background: #fff;
    box-shadow: 0 0 0 .25mm rgba(0,0,0,.12), 0 2.5mm 7mm rgba(0,0,0,.10); }
  .janela header { display: flex; align-items: center; gap: 1.4mm; height: 6.4mm; padding: 0 2.6mm;
    background: var(--fundo-alt); border-bottom: .25mm solid #e5e5ea; position: relative; }
  .janela header i { width: 2.3mm; height: 2.3mm; border-radius: 50%; background: #ff5f57; }
  .janela header i:nth-child(2) { background: #febc2e; }
  .janela header i:nth-child(3) { background: #28c840; }
  .janela header span { position: absolute; left: 0; right: 0; text-align: center; font-size: 7.5pt; font-weight: 500; color: var(--fraca); }
  .janela img { display: block; width: 100%; }
  .recorte img { max-height: 92mm; object-fit: cover; object-position: top; }
  .recorte-baixo img { max-height: 70mm; object-fit: cover; object-position: top; }
  .solta { display: block; width: 100%; border-radius: 3mm; }

  /* Página de resumo para a diretoria */
  .cartoes { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 6mm; }
  .cartao { background: var(--fundo-alt); border-radius: 4mm; padding: 5mm 5.5mm; }
  .cartao h3 { font-size: 11.5pt; margin-top: 0; }
  .cartao p { color: #3a3a3c; margin: 0; font-size: 9.8pt; }
  .cartao .simbolo { width: 8mm; height: 8mm; border-radius: 2.2mm; display: grid; place-items: center;
    color: #fff; font-weight: 700; font-size: 11pt; margin-bottom: 3mm; }
  .numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 2mm 0 6mm; }
  .numero { border-top: .35mm solid var(--separador); padding-top: 3mm; }
  .numero strong { display: block; font-size: 22pt; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
  .numero span { font-size: 9pt; color: var(--fraca); }
  .fluxo { display: flex; align-items: stretch; gap: 2mm; margin: 2mm 0 6mm; }
  .fluxo div { flex: 1; background: var(--acao-fraca); border-radius: 3mm; padding: 3.2mm 3mm; font-size: 9pt; color: #1d1d1f; }
  .fluxo div b { display: block; color: var(--acao); font-size: 9.5pt; margin-bottom: .6mm; }
  .fluxo .seta { flex: 0 0 auto; background: none; padding: 0; display: grid; place-items: center; color: var(--tenue); font-size: 12pt; }

  /* Passos */
  .passos { display: flex; flex-direction: column; gap: 7mm; flex: 1; }
  .passo { display: grid; grid-template-columns: 1fr 1.05fr; gap: 8mm; align-items: start; }
  .passo--largo { grid-template-columns: 1fr; gap: 4mm; }
  .passo--largo .passo__figura { max-width: 150mm; }
  .passo__n { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border-radius: 50%;
    background: var(--acao); color: #fff; font-weight: 600; font-size: 10pt; }
  .passo__texto p { color: #3a3a3c; }
  .passo__texto ul { margin: 0 0 2.2mm; padding-left: 4.5mm; color: #3a3a3c; }
  .passo__texto li { margin-bottom: 1mm; }
  .dica { background: var(--fundo-alt); border-radius: 2.5mm; padding: 2.6mm 3.4mm; font-size: 9.2pt; color: #3a3a3c; }
  .dica::before { content: 'Dica  '; font-weight: 600; color: var(--acao); }
  .atencao { background: var(--alerta-fraca); border-radius: 2.5mm; padding: 2.6mm 3.4mm; font-size: 9.2pt; color: #3a3a3c; }
  .atencao::before { content: 'Atenção  '; font-weight: 600; color: var(--alerta); }
  .dupla { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }

  /* Lista de conferência */
  .lista { list-style: none; padding: 0; margin: 0 0 5mm; }
  .lista li { display: grid; grid-template-columns: 6mm 1fr; gap: 2mm; padding: 2.6mm 0; border-bottom: .25mm solid #e5e5ea; }
  .lista li::before { content: ''; width: 4mm; height: 4mm; border-radius: 1.2mm; border: .35mm solid var(--tenue); margin-top: .6mm; }
  .problemas { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; }
  .problemas div { border-top: .25mm solid #e5e5ea; padding-top: 2.4mm; }
  .problemas > div > b { display: block; margin-bottom: .6mm; }
  .problemas p { color: #3a3a3c; font-size: 9.4pt; margin: 0; }

  /* Chrome desenhado em volta da página do SIGAA */
  .chrome { margin: 0; overflow: hidden; border-radius: 3mm; background: #fff;
    box-shadow: 0 0 0 .25mm rgba(0,0,0,.14), 0 3mm 9mm rgba(0,0,0,.12); }
  .chrome__abas { display: flex; align-items: flex-end; gap: 1.4mm; height: 8mm; padding: 0 3mm; background: #dee1e6; }
  .chrome__abas i { width: 2.3mm; height: 2.3mm; border-radius: 50%; background: #ff5f57; align-self: center; }
  .chrome__abas i:nth-child(2) { background: #febc2e; }
  .chrome__abas i:nth-child(3) { background: #28c840; margin-right: 3mm; }
  .chrome__aba { background: #fff; border-radius: 2mm 2mm 0 0; padding: 1.4mm 4mm; font-size: 7.5pt; color: #3c4043; }
  .chrome__endereco { background: #fff; padding: 1.4mm 3mm; }
  .chrome__endereco span { display: block; background: #f1f3f4; border-radius: 4mm; padding: 1mm 3.5mm; font-size: 7.5pt; color: #3c4043; }
  .chrome__favoritos { display: flex; gap: 4mm; padding: 1mm 4mm 1.6mm; font-size: 7.5pt; color: #5f6368; border-bottom: .25mm solid #dadce0; }
  .chrome__adsum { color: var(--acao); font-weight: 600; background: var(--acao-fraca); border-radius: 1.5mm; padding: 0 1.8mm; }
  .chrome img { display: block; width: 100%; }
  .mesa { position: relative; height: 90mm; margin-top: 1mm; }
  .mesa .chrome { position: absolute; left: 0; top: 0; width: 140mm; }
  .mesa .chrome img { max-height: 70mm; object-fit: cover; object-position: top left; }
  .mesa .janela { position: absolute; right: 0; top: 7mm; width: 56mm; }
  .mesa .janela img { max-height: 74mm; object-fit: cover; object-position: top; }
  .largo img { max-height: 92mm; object-fit: cover; object-position: top left; }
  .estreita { max-width: 58mm; margin-left: auto; }
  .estreita img { max-height: 44mm; object-fit: cover; object-position: top; }
  .explica { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin-bottom: 3mm; }
  .explica p { color: #3a3a3c; }
</style>

<!-- 1 · Capa -->
<div class="folha capa">
  <div>
    ${img(ICONE, 'icone')}
    <h1>Adsum</h1>
    <p class="lead">A chamada por crachá, do primeiro dia de aula até a frequência lançada no SIGAA.</p>
  </div>
  <div class="leque">
    ${janela(t.repouso, 'Adsum', 'esq')}
    ${janela(t.chamada, 'Adsum · IF685 · T01', 'meio')}
    ${janela(t.sigaaJanela, 'Adsum · SIGAA', 'dir')}
  </div>
  <div class="pe">
    <div><b>Guia de uso</b><br>Para professores do CIn/UFPE e para a coordenação</div>
    <div class="creditos">
      <span class="creditos__rotulo">Criado por</span>
      <span class="creditos__nomes">Prof. Paulo Freitas <span class="creditos__e">e</span> Willian Rupert</span>
      <span class="creditos__onde">Centro de Informática · UFPE</span>
    </div>
  </div>
</div>

<!-- 2 · O que é -->
<div class="folha">
  <p class="sobretitulo">Em uma página</p>
  <h2>O que o Adsum faz</h2>
  <p class="lead">O aluno encosta o crachá do CIn num leitor USB na mesa do professor. O nome aparece na tela, a presença fica gravada, e no fim do dia as faltas vão para a planilha de frequência do SIGAA em três cliques.</p>

  <div class="fluxo">
    <div><b>Crachá</b>O aluno encosta o crachá ao entrar</div>
    <div class="seta">›</div>
    <div><b>Adsum</b>Nome na tela, presença gravada na pasta do professor</div>
    <div class="seta">›</div>
    <div><b>SIGAA</b>Favorito, Preencher, Gravar Frequências</div>
  </div>

  <div class="cartoes">
    <div class="cartao"><div class="simbolo" style="background:var(--acao)">1</div>
      <h3>Sem servidor, sem conta, sem senha</h3>
      <p>É um site que roda no Chrome do professor. Não há cadastro, banco central nem custo de infraestrutura. O Adsum nunca vê nem guarda a senha do SIGAA.</p></div>
    <div class="cartao"><div class="simbolo" style="background:var(--verde)">2</div>
      <h3>Os dados não saem do computador</h3>
      <p>Tudo fica numa pasta escolhida pelo professor, em planilhas que ele abre e copia. Nada é enviado pela rede. Se a pasta estiver no Google Drive ou no iCloud, a cópia de segurança vem de graça.</p></div>
    <div class="cartao"><div class="simbolo" style="background:#5e5ce6">3</div>
      <h3>O crachá é lido, não copiado</h3>
      <p>O Adsum lê só o número público do cartão, o mesmo que qualquer leitor vê, e a frequência guarda um resumo criptográfico dele. Não toca nas chaves do crachá do CIn.</p></div>
    <div class="cartao"><div class="simbolo" style="background:var(--alerta)">4</div>
      <h3>O professor decide o que vai ao SIGAA</h3>
      <p>O Adsum preenche só aulas ainda vazias, mostra cada diferença com o que o SIGAA já tem e nunca altera o que lá está. Quem grava é o professor.</p></div>
  </div>

  <h3>O que cada sala precisa</h3>
  <div class="numeros">
    <div class="numero"><strong>1 leitor</strong><span>USB de 13,56 MHz, que funciona como teclado: sem driver, no Mac, no Windows e no Linux</span></div>
    <div class="numero"><strong>Chrome</strong><span>ou Edge, no computador que o professor já usa em sala</span></div>
    <div class="numero"><strong>0 instalação</strong><span>o endereço abre o Adsum; instalar como app é opcional e leva um clique</span></div>
  </div>
  <p style="color:var(--fraca); font-size:9.4pt">Em uso real desde setembro de 2026 na turma do Prof. Paulo. Em 22/10/2026, na sala do Prof. Paulo, o Adsum conferiu a turma contra o SIGAA, apontou cada diferença e lançou as faltas na planilha de frequência, que o professor gravou. O código é aberto e cada versão passa por testes automáticos com o leitor de verdade antes de ir ao ar.</p>
  <div class="rodape"><span>Adsum · guia de uso</span><span>2</span></div>
</div>

<!-- 3 · Antes da primeira aula -->
<div class="folha">
  <p class="sobretitulo">Uma vez só, antes da primeira aula</p>
  <h2>Preparar o computador</h2>
  <p class="lead">Dez minutos, uma vez por computador. Nada aqui se repete nas aulas seguintes.</p>
  <div class="passos">
    ${passo(1, 'Abra no Chrome', `
      <p>Abra <span class="mono">${ENDERECO_DO_SITE}</span> no <b>Chrome</b> (ou no Edge). Só eles deixam o Adsum gravar direto numa pasta do computador.</p>
      <p>Ligue o leitor numa porta USB. Não há o que instalar: ele se apresenta ao computador como um teclado.</p>
      ${dica('Uma vez só, o Adsum oferece abrir em janela própria, com ícone no Dock ou na barra de tarefas. Toque em <b>Instalar</b>: ele passa a abrir num clique, sem procurar entre as abas.')}`,
      `<div class="dupla" style="grid-template-columns:1fr">${janela(t.leitor, 'Ajustes · O leitor de crachá')}</div>`)}
    ${passo(2, 'Escolha onde guardar', `
      <p>Na primeira abertura, o Adsum pede uma pasta. É ali que tudo vai viver: chamadas, faltas e vínculos dos crachás, em planilhas comuns.</p>
      <p>Crie uma pasta chamada <b>Adsum</b> dentro do <b>Google Drive</b> ou do <b>iCloud Drive</b>. Assim existe uma cópia fora do computador, sem o Adsum falar com servidor nenhum.</p>
      ${dica('Se o Chrome perguntar de novo, numa outra sessão, é só clicar em liberar o acesso. A pasta continua lá.')}`,
      janela(t.pasta, 'Adsum', 'recorte'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>3</span></div>
</div>

<!-- 4 · Turma e cronograma -->
<div class="folha">
  <p class="sobretitulo">Uma vez por turma</p>
  <h2>Cadastrar a turma</h2>
  <p class="lead">A lista vem do próprio SIGAA, copiada e colada. Ninguém digita nome.</p>
  <div class="passos">
    ${passo(3, 'Cole a lista de participantes', `
      <p>No SIGAA, entre na turma virtual e abra <b>Turma › Participantes</b>. Selecione a página inteira (<kbd>⌘A</kbd> no Mac, <kbd>Ctrl+A</kbd> no Windows), copie e cole no Adsum.</p>
      <p>O Adsum separa docentes de discentes e confere o total contra o que a página declara. Se a página diz 48 e ele achou 46, ele mostra as linhas que não entendeu.</p>
      <p>Todos entram como aluno. Na lista da chamada, troque <b>Aluno</b> por <b>Professor</b> na sua linha; o Adsum avisa enquanto ninguém estiver marcado. É o seu crachá que abre e encerra a chamada.</p>`,
      janela(t.turma, 'Adsum', 'recorte'))}
    ${passo(4, 'Marque o horário das aulas', `
      <p>Dia da semana e horário de cada aula. Com isso, na hora da aula, a turma certa já aparece na tela inicial.</p>
      <p>É opcional e pode ser feito depois. Mais de uma turma? Cada uma se cadastra do mesmo jeito, em <b>Cadastrar nova turma</b>.</p>`,
      janela(t.cronograma, 'Adsum', 'recorte-baixo'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>4</span></div>
</div>

<!-- 5 · A aula -->
<div class="folha">
  <p class="sobretitulo">Toda aula</p>
  <h2>Fazer a chamada</h2>
  <p class="lead">Abrir, deixar a fila passar, encerrar. A tela muda sozinha conforme o momento.</p>
  <div class="passos">
    ${passo(5, 'Abra a chamada', `
      <p>A tela inicial já mostra a turma da hora. Abra a chamada com <b>Enter</b>, no botão, ou encostando o <b>seu crachá</b>.</p>
      <p>Ela não abre sozinha de propósito: a aula de fato quase nunca começa na hora da grade. Há <b>uma chamada por turma por dia</b>, como no SIGAA: encerrar e reabrir continua de onde parou.</p>`,
      janela(t.repouso, 'Adsum', 'recorte-baixo'))}
    ${passo(6, 'Os alunos encostam o crachá', `
      <p>Cada crachá mostra o nome e conta presença. Encostar duas vezes não conta duas. Esquecer o crachá não é problema: <b>Presente</b> na linha do aluno marca à mão.</p>
      <p>A lista da turma fica sempre à vista, para conferir quem chegou.</p>
      <div class="atencao">Durante a chamada, a janela do Adsum precisa estar <b>na frente</b>. O leitor digita onde estiver o cursor, como um teclado.</div>`,
      janela(t.chamada, 'Adsum · IF685 · T01', 'recorte'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>5</span></div>
</div>

<!-- 6 · Primeiro dia e crachá novo -->
<div class="folha">
  <p class="sobretitulo">Primeiro dia, e quem chega depois</p>
  <h2>Ligar crachá e aluno</h2>
  <p class="lead">Não há tela de cadastro à parte. O vínculo acontece na própria chamada, com o aluno na frente do professor.</p>
  <div class="passos">
    ${passo(7, 'Crachá desconhecido abre a busca', `
      <p>No primeiro dia ninguém tem crachá ligado. Quando um crachá desconhecido é lido, o Adsum abre uma busca: o aluno diz o nome, o professor digita as primeiras letras e confirma. Presença contada e crachá ligado, de uma vez.</p>
      <p>O mesmo vale semanas depois: quem faltou no primeiro dia, ou trouxe uma segunda via, se cadastra no dia em que aparece. Quem ainda não tem crachá aparece primeiro na busca.</p>
      ${dica('Ligou o crachá à pessoa errada? <b>Remover crachá</b>, ao lado do nome, desfaz ali mesmo. A presença já gravada continua no registro.')}`,
      janela(t.busca, 'Adsum', 'recorte'))}
    ${passo(8, 'Chamar nomes, para uma fila grande', `
      <p>Com a turma inteira chegando de uma vez, ligue <b>Chamar nomes</b>. A tela mostra um nome grande e o próximo crachá desconhecido vira daquela pessoa, sem busca. Em seguida vem a próxima pessoa sem crachá; as setas do teclado andam pela fila.</p>
      <p>Dois crachás encostados quase juntos não contam dois: a tela avisa, e o professor, que está na sala, decide.</p>`,
      janela(t.pendentes, 'Adsum · IF685 · T01', 'recorte'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>6</span></div>
</div>

<!-- 7 · Encerrar e conferir -->
<div class="folha">
  <p class="sobretitulo">Fim da aula</p>
  <h2>Encerrar e conferir</h2>
  <p class="lead">Com a pasta escolhida, não há o que salvar: cada presença foi gravada no disco no momento em que aconteceu.</p>
  <div class="passos">
    ${passo(9, 'Encerre a chamada', `
      <p>Pelo botão <b>Encerrar</b>, ou encostando o seu crachá. A tela mostra quantos estiveram presentes e onde está o arquivo da turma.</p>
      <p>Fechar o Adsum também encerra a chamada. Recarregar a página, não.</p>`,
      janela(t.fim, 'Adsum', 'recorte-baixo'))}
    ${passo(10, 'Corrigir uma presença depois', `
      <p>Na tela inicial, <b>Ver presenças</b> abre a planilha do semestre: cada aluno, cada aula, presença e falta.</p>
      <p>Em <b>Editar</b>, cada quadrado vira botão e uma falta vira presença, ou o contrário. Toda correção é um registro novo: nada do que foi gravado é apagado, e o quadrado corrigido fica identificável depois.</p>`,
      janela(t.planilha, 'Adsum · Presenças', 'recorte-baixo'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>7</span></div>
</div>

<!-- 8 · SIGAA -->
<div class="folha">
  <p class="sobretitulo">Quando quiser: toda aula, toda semana ou no fim do semestre</p>
  <h2>Lançar no SIGAA</h2>
  <p class="lead">Três cliques além de chegar à planilha do SIGAA, seja um dia ou sessenta: o favorito, Preencher e Gravar Frequências. As telas abaixo são da planilha do SIGAA de verdade, com os alunos trocados por nomes inventados.</p>
  <div class="passos">
    ${passo(11, 'Arraste o favorito, uma vez só', `
      <p>No Adsum, abra os <b>Ajustes</b> (a engrenagem) e, em <b>Lançar no SIGAA</b>, arraste o botão <b>Adsum</b> até a barra de favoritos do Chrome. Arrastar, não clicar.</p>
      <p>Sem a barra à vista? <kbd>⇧⌘B</kbd> no Mac, <kbd>Ctrl+Shift+B</kbd> no Windows.</p>`,
      janela(t.favorito, 'Ajustes · Lançar no SIGAA'))}
    <section>
      <div class="explica">
        <div>
          <span class="passo__n">12</span>
          <h3>Na planilha do SIGAA, clique no favorito</h3>
          <p>Entre no SIGAA como sempre. Na turma, abra <b>Lançar Freq. em Planilha</b> e clique no favorito <b>Adsum</b>. A janela do Adsum abre ao lado e compara a planilha com as chamadas, aluno por aluno, pela matrícula.</p>
        </div>
        <div>
          <p style="margin-top:9mm">Ela diz quantas aulas há para lançar, com presentes e faltas de cada uma. Onde o SIGAA e o Adsum discordam, mostra cada diferença, e o professor escolhe. Aula já lançada no SIGAA nunca é alterada.</p>
          <div class="atencao">Não deixe o Chrome em <b>tela cheia</b>. No Mac, em tela cheia a janela do Adsum vira uma aba e esconde a planilha.</div>
        </div>
      </div>
      <div class="mesa">
        ${chrome(t.sigaaPlanilha, 'SIGAA · Turma Virtual', 'sigaa.ufpe.br')}
        ${janela(t.sigaaJanela, 'Adsum · SIGAA')}
      </div>
    </section>
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>8</span></div>
</div>

<!-- 9 · Preencher e gravar -->
<div class="folha">
  <p class="sobretitulo">Lançar no SIGAA, continuação</p>
  <h2>Preencher, conferir, gravar</h2>
  <p class="lead">O Adsum escreve na planilha que está aberta, na sessão do professor. Quem grava é o SIGAA.</p>
  <div class="passos">
    <section>
      <div class="explica">
        <div>
          <span class="passo__n">13</span>
          <h3>Preencher, e conferir de olho</h3>
          <p><b>Preencher</b> escreve só as células vazias: presença vale 0, falta vale o número de aulas daquele dia. O que foi preenchido fica em azul, e as faltas em azul forte.</p>
        </div>
        <div>
          <p style="margin-top:9mm">Confira e clique em <b>Gravar Frequências</b>, no fim da planilha. Se não clicar, o próprio SIGAA salva sozinho em até 5 minutos.</p>
          ${dica('Mudou de ideia antes de gravar? <b>Desfazer</b>, na barra do pé da planilha, ou feche a aba do SIGAA sem gravar.')}
        </div>
      </div>
      ${chrome(t.sigaaPreenchida, 'SIGAA · Turma Virtual', 'sigaa.ufpe.br', 'largo')}
    </section>
    ${passo(14, 'Clique no favorito de novo', `
      <p>Depois de gravar, um novo clique no favorito é a conferência final: a janela deve dizer <b>Tudo confere</b>.</p>
      <p>Cada preenchimento fica registrado na pasta do Adsum, para quem quiser auditar depois.</p>`,
      janela(t.sigaaConfere, 'Adsum · SIGAA', 'estreita'))}
  </div>
  <div class="rodape"><span>Adsum · guia de uso</span><span>9</span></div>
</div>

<!-- 10 · Resumo e problemas -->
<div class="folha">
  <p class="sobretitulo">Para deixar ao lado do computador</p>
  <h2>Em resumo</h2>
  <ul class="lista" style="margin-top:4mm">
    <li><span><b>Uma vez:</b> Chrome, leitor na USB, pasta Adsum no Drive, favorito na barra.</span></li>
    <li><span><b>Por turma:</b> colar Turma › Participantes do SIGAA e marcar-se como professor.</span></li>
    <li><span><b>Toda aula:</b> Enter ou o seu crachá abre; a fila encosta; o seu crachá encerra.</span></li>
    <li><span><b>Quando quiser:</b> planilha do SIGAA, favorito, Preencher, Gravar Frequências, favorito de novo.</span></li>
  </ul>

  <h3 style="margin-top:4mm">Quando algo não sai como esperado</h3>
  <div class="problemas" style="margin-top:2mm">
    <div><b>O crachá não faz nada</b><p>A janela do Adsum está na frente? O leitor digita onde está o cursor. Clique no Adsum e encoste de novo.</p></div>
    <div><b>“Sem leitor”</b><p>O leitor não respondeu. Tire e recoloque na USB. Os Ajustes mostram o leitor e o Diagnóstico mostra o que chegou dele.</p></div>
    <div><b>Crachá ligado à pessoa errada</b><p><b>Remover crachá</b>, ao lado do nome, e encostar de novo com a pessoa certa chamada.</p></div>
    <div><b>O Adsum pede a pasta outra vez</b><p>O Chrome esqueceu a permissão, não a pasta. Escolha a mesma pasta: tudo volta.</p></div>
    <div><b>O favorito não abre a janela</b><p>Confira se a página é a <b>Lançar Freq. em Planilha</b> e se o Chrome não está em tela cheia.</p></div>
    <div><b>Computador novo</b><p>Abra o Adsum no Chrome e escolha a mesma pasta, vinda do Drive. Turmas, crachás e chamadas estão nela.</p></div>
  </div>

  <div class="cartao" style="margin-top:auto; margin-bottom:6mm">
    <h3>Privacidade, em uma frase</h3>
    <p>A frequência guarda nome e matrícula, que vêm do SIGAA, e um resumo criptográfico do crachá. Login e senha do SIGAA nunca. Nesta fase de testes, o número do crachá fica também num arquivo à parte da pasta, sem nome, para não obrigar a turma a recadastrar; o professor o desliga no Diagnóstico. Tudo fica no computador do professor. O manual completo, com o tratamento para fins de LGPD, está nos Ajustes, em <b>Manual e LGPD</b>.</p>
  </div>
  <div class="rodape"><span>Adsum · guia de uso · ${ENDERECO_DO_SITE}</span><span>10</span></div>
</div>
</html>`
}
