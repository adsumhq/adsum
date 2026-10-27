// A mudança pelo arquivo, no motor do Safari (WebKit): o caminho de quem não
// tem pasta. A base entra no endereço antigo pelo botão "Tenho um backup do
// Adsum" (o mesmo que o endereço novo vai usar), a ponte é publicada no lugar
// do app, baixa o backup, e o endereço novo o restaura.
//
// O que isto não prova: o app instalado no Dock, com armazenamento próprio. O
// Playwright não instala app; esse caso continua sendo ensaio à mão.
//
// Configurável como o `mudanca.spec.ts`: ADSUM_COFRE e ADSUM_NOVA. Sem o cofre,
// o teste se pula: é dado real de turma, fora do repositório.

import { existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { devices, expect, test, type Page } from '@playwright/test'
import { hospedar, versoesDaMudanca, type Hospedagem, type Versao } from './apoio/versoes.ts'
import { contarBase, eventosDaBase, lerCofre } from './apoio/cofre.ts'

const COFRE = process.env.ADSUM_COFRE ?? join(homedir(), 'Downloads/Chamadas 3.zip')
const ANTIGA = 4323
const NOVA = 4324
const MUDANCA = {
  de: { origem: `http://localhost:${ANTIGA}`, caminho: '/adsum/' },
  para: { origem: `http://127.0.0.1:${NOVA}`, caminho: '/adsum/' },
}

test.skip(!existsSync(COFRE), `sem o cofre em ${COFRE} (ADSUM_COFRE)`)
test.use({ ...devices['Desktop Safari'], channel: undefined })

let app: Versao
let ponte: Versao
let antiga: Hospedagem
let nova: Hospedagem

test.beforeAll(async () => {
  test.setTimeout(10 * 60_000)
  ;({ app, ponte } = versoesDaMudanca(process.env.ADSUM_NOVA ?? 'HEAD', MUDANCA))
  antiga = await hospedar(ANTIGA)
  nova = await hospedar(NOVA)
})
test.afterAll(async () => {
  await antiga?.fechar()
  await nova?.fechar()
})

/** O cofre do zip no formato do backup da ponte (`nucleo/mudanca.ts`): só o que a restauração lê. */
function backupDoCofre(destino: string) {
  const arquivos = Object.entries(lerCofre(COFRE))
    .filter(([c]) => /^(config|vinculos|grade)\.json$|^turmas\/.+\.json$|^(registros|sigaa)\/.+\.csv$/.test(c))
    .map(([caminho, base64]) => ({ caminho, texto: Buffer.from(base64, 'base64').toString('utf-8') }))
  writeFileSync(destino, JSON.stringify({ tipo: 'adsum-backup', versao: 1, gravadoEm: new Date().toISOString(), arquivos }))
}

/** O conselho de usar o Chrome aparece antes da primeira turma: quem fica no Safari segue. */
async function ficarNoSafari(page: Page) {
  const seguir = page.getByRole('button', { name: /^Continuar (sem instalar|assim)$/ })
  await seguir.click({ timeout: 15_000 })
}

async function restaurarBackup(page: Page, arquivo: string) {
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Tenho um backup do Adsum' }).click()])
  await seletor.setFiles(arquivo)
  // Com turma na base, o app sai da tela de colar sozinho, e o recado vai junto.
  await expect(page.getByRole('button', { name: /Começar a chamada/ })).toBeVisible({ timeout: 20_000 })
}

const dados = (base: Record<string, number>) =>
  Object.fromEntries(Object.entries(base).filter(([tabela]) => !['sessao', 'pasta', 'config'].includes(tabela)))

const quemPorCracha = async (page: Page) =>
  new Map((await eventosDaBase(page)).filter((e) => e.quem).map((e) => [e.uidHash, e.quem]))

test('no Safari, a ponte baixa o backup e o endereço novo o restaura inteiro', async ({ page, context }) => {
  test.setTimeout(10 * 60_000)
  await context.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (rota) => rota.abort())
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  // O endereço antigo com a base de um professor, só no navegador.
  const doCofre = test.info().outputPath('do-cofre.json')
  backupDoCofre(doCofre)
  antiga.publicar(app)
  await page.goto(antiga.url + '/adsum/')
  await ficarNoSafari(page)
  await restaurarBackup(page, doCofre)
  const naAntiga = dados(await contarBase(page))
  const quemNaAntiga = await quemPorCracha(page)
  expect(naAntiga.vinculos).toBeGreaterThan(0)

  // A ponte no lugar do app.
  antiga.publicar(ponte)
  await page.evaluate(() => navigator.serviceWorker?.getRegistration().then((r) => r?.update()))
  await expect
    .poll(
      async () => {
        await page.reload().catch(() => {})
        return page.getByText('O Adsum mudou de endereço').isVisible()
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBe(true)

  const [baixado] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar o backup' }).click()])
  expect(baixado.suggestedFilename()).toBe('adsum-backup.json')
  const backup = test.info().outputPath('adsum-backup.json')
  await baixado.saveAs(backup)

  // O endereço novo, do zero, pelo mesmo botão.
  nova.publicar(app)
  const nova_ = await context.newPage()
  nova_.on('pageerror', (e) => erros.push(e.message))
  await nova_.goto(MUDANCA.para.origem + '/adsum/')
  await ficarNoSafari(nova_)
  await restaurarBackup(nova_, backup)
  expect(dados(await contarBase(nova_))).toEqual(naAntiga)
  expect(await quemPorCracha(nova_)).toEqual(quemNaAntiga)
  // A ponte só copia.
  expect(dados(await contarBase(page))).toEqual(naAntiga)

  expect(erros).toEqual([])
})
