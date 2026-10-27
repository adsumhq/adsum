// A mudança de endereço na máquina do professor (`docs/14_casa_nova.md`): o
// app que está no ar, com o cofre dele, recebe a ponte no mesmo endereço pelo
// service worker de verdade; a ponte leva a base a outra origem; lá, a mesma
// pasta é escolhida e os crachás da turma continuam sendo as mesmas pessoas.
//
// Duas origens locais fazem o papel das duas casas: `localhost` é a antiga e
// `127.0.0.1` a nova. Para o navegador são tão distintas quanto as duas
// casas de `MUDANCA`, em `endereco.ts`: base, pasta da OPFS e service worker
// de cada uma são só dela.
//
// Configurável pelo ambiente, como o `atualizacao.spec.ts`:
//   ADSUM_COFRE   o zip da pasta do professor (padrão: ~/Downloads/Chamadas 3.zip)
//   ADSUM_NO_AR   a versão no ar (padrão: o commit do último deploy que terminou bem)
//   ADSUM_NOVA    o commit da ponte e do app novo (padrão: HEAD)
// Sem o cofre, os testes se pulam: é dado real de turma, fora do repositório.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { commitNoAr, hospedar, versao, versoesDaMudanca, PAGINA_VAZIA, type Hospedagem, type Versao } from './apoio/versoes.ts'
import { PASTA, comArquivosDeFora, contarBase, eventosDaBase, lerCofre, lerPasta, semear, type ArquivosDoCofre } from './apoio/cofre.ts'
import { encostar } from './apoio/dongle.ts'

const COFRE = process.env.ADSUM_COFRE ?? join(homedir(), 'Downloads/Chamadas 3.zip')
const ANTIGA = 4321
const NOVA = 4322
const MUDANCA = {
  de: { origem: `http://localhost:${ANTIGA}`, caminho: '/adsum/' },
  para: { origem: `http://127.0.0.1:${NOVA}`, caminho: '/adsum/' },
}

test.skip(!existsSync(COFRE), `sem o cofre em ${COFRE} (ADSUM_COFRE)`)
// O Chrome instalado, como no `atualizacao.spec.ts`: o Chromium do Playwright
// cai quando o service worker assume a página com a OPFS em uso.
test.use({ channel: 'chrome' })

let noAr: Versao
let app: Versao
let ponte: Versao
let cofre: ArquivosDoCofre
let antiga: Hospedagem
let nova: Hospedagem

test.beforeAll(async () => {
  test.setTimeout(10 * 60_000)
  noAr = versao(process.env.ADSUM_NO_AR ?? commitNoAr())
  ;({ app, ponte } = versoesDaMudanca(process.env.ADSUM_NOVA ?? 'HEAD', MUDANCA))
  cofre = comArquivosDeFora(lerCofre(COFRE))
  antiga = await hospedar(ANTIGA)
  nova = await hospedar(NOVA)
})
test.afterAll(async () => {
  await antiga?.fechar()
  await nova?.fechar()
})

/** Nada sai da máquina, e o seletor de pasta devolve a pasta da OPFS, nas duas origens e no popup. */
async function prepararContexto(context: BrowserContext) {
  await context.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (rota) => rota.abort())
  await context.addInitScript((pasta) => {
    ;(window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle(pasta, { create: true })
  }, PASTA)
}

/** Os crachás do cofre que têm dono, como no `atualizacao.spec.ts`. */
function crachasDoCofre(): { uid: string; uidHash: string }[] {
  const csv = Buffer.from(cofre['auditoria/uids.csv'] ?? '', 'base64').toString('utf-8').replace(/^﻿/, '')
  const vinculos: unknown = JSON.parse(Buffer.from(cofre['vinculos.json'] ?? '', 'base64').toString('utf-8') || '[]')
  const lista = (Array.isArray(vinculos) ? vinculos : ((vinculos as { conteudo?: unknown[] }).conteudo ?? [])) as { uidHash?: string }[]
  const comDono = new Set(lista.map((v) => v.uidHash))
  const vistos = new Map<string, string>()
  for (const linha of csv.split(/\r?\n/).slice(1)) {
    const [uid, uidHash] = linha.split(';')
    if (uid && uidHash && comDono.has(uidHash)) vistos.set(uid, uidHash)
  }
  return [...vistos].map(([uid, uidHash]) => ({ uid, uidHash }))
}

/** O que a base tem de dado: a chamada aberta e o handle da pasta são estado desta origem. */
const dados = (base: Record<string, number>) =>
  Object.fromEntries(Object.entries(base).filter(([tabela]) => !['sessao', 'pasta', 'config'].includes(tabela)))

/** Quem é cada crachá para a base, pelo número tirado do nome (nunca o nome). */
async function quemPorCracha(page: Page) {
  return new Map((await eventosDaBase(page)).filter((e) => e.quem).map((e) => [e.uidHash, e.quem]))
}

test('a ponte leva a base ao endereço novo, a mesma pasta não duplica nada, e os crachás continuam sendo as mesmas pessoas', async ({ page, context }) => {
  test.setTimeout(10 * 60_000)
  await prepararContexto(context)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  // O endereço antigo, com a versão do ar e o cofre do professor.
  antiga.publicar(noAr)
  await page.goto(antiga.url + PAGINA_VAZIA)
  await semear(page, cofre)
  await page.goto(antiga.url + '/adsum/')
  await page.getByRole('button', { name: 'Escolher pasta' }).click()
  await expect(page.getByRole('button', { name: /Começar a chamada/ })).toBeVisible({ timeout: 20_000 })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20_000 })
  await page.waitForTimeout(3000) // a pasta termina de ser conferida
  const naAntiga = dados(await contarBase(page))
  const quemNaAntiga = await quemPorCracha(page)
  expect(naAntiga.vinculos).toBeGreaterThan(0)

  // A ponte é publicada no mesmo endereço. O app antigo acha o `sw.js` novo,
  // como numa atualização qualquer, e a página seguinte já é a ponte.
  antiga.publicar(ponte)
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
  await expect
    .poll(
      async () => {
        await page.reload().catch(() => {})
        return page.getByText('O Adsum mudou de endereço').isVisible()
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBe(true)
  await expect(page.getByText(`${naAntiga.vinculos} crachás`, { exact: false })).toBeVisible()
  // As telas só mostram números, nunca nome: a captura pode ficar no relatório.
  await page.screenshot({ path: test.info().outputPath('ponte.png') })

  // Levar meus dados: a janela do endereço novo abre, recebe e responde.
  nova.publicar(app)
  const [chegada] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Levar meus dados' }).click()])
  chegada.on('pageerror', (e) => erros.push(e.message))
  await expect(chegada.getByText('Seus dados chegaram')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Seus dados estão no endereço novo')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('ponte-depois.png') })
  await chegada.screenshot({ path: test.info().outputPath('chegada.png') })
  expect(new URL(chegada.url()).origin).toBe(MUDANCA.para.origem)
  expect(dados(await contarBase(chegada))).toEqual(naAntiga)
  expect(await quemPorCracha(chegada)).toEqual(quemNaAntiga)
  // A ponte só copia: a base do endereço antigo continua lá.
  expect(dados(await contarBase(page))).toEqual(naAntiga)

  // No Chrome, o app novo pede a pasta. A mesma pasta, escolhida depois de a
  // base chegar, não duplica nada.
  const pastaDaAntiga = await lerPasta(page)
  await semear(
    chegada,
    Object.fromEntries(Object.entries(pastaDaAntiga).map(([c, texto]) => [c, Buffer.from(texto).toString('base64')])),
  )
  await chegada.getByRole('button', { name: 'Abrir o Adsum' }).click()
  await chegada.getByRole('button', { name: 'Escolher pasta' }).click()
  await expect(chegada.getByRole('button', { name: /Começar a chamada/ })).toBeVisible({ timeout: 20_000 })
  await chegada.waitForTimeout(3000)
  expect(dados(await contarBase(chegada))).toEqual(naAntiga)

  // Uma chamada no endereço novo: cada crachá do cofre é reconhecido, e é a
  // mesma pessoa que era no antigo. É o sal que viajou.
  const crachas = crachasDoCofre()
  expect(crachas.length).toBeGreaterThan(0)
  const antes = new Set((await eventosDaBase(chegada)).map((e) => e.id))
  await chegada.getByRole('button', { name: /Começar a chamada/ }).click()
  await expect(chegada.getByRole('button', { name: 'Encerrar', exact: true })).toBeVisible({ timeout: 15_000 })
  for (const c of crachas) await encostar(chegada, c.uid)
  const doCofre = new Set(crachas.map((c) => c.uidHash))
  // Só os crachás: abrir a chamada também é evento.
  const novos = async () => (await eventosDaBase(chegada)).filter((e) => !antes.has(e.id) && doCofre.has(e.uidHash))
  await expect.poll(async () => new Set((await novos()).map((e) => e.uidHash)).size, { timeout: 15_000 }).toBe(crachas.length)
  for (const e of await novos()) {
    expect(e.resultado, 'crachá reconhecido no endereço novo').not.toBe('desconhecido')
    if (quemNaAntiga.has(e.uidHash)) expect(e.quem, 'a mesma pessoa nos dois endereços').toBe(quemNaAntiga.get(e.uidHash))
  }

  expect(erros).toEqual([])
})
