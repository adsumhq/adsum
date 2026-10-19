#!/usr/bin/env node
// O SIGAA de demonstração: o Chrome de verdade, numa janela que se usa à mão,
// com `sigaa.ufpe.br` e `willianrupert.github.io/adsum` atendidos daqui. É o
// que a jornada (`e2e/jornada.spec.ts`) faz sozinha, deixado para uma pessoa
// mostrar a outra: colar a turma, fazer chamadas, arrastar o favorito publicado
// para a barra, e lançar na planilha (a anonimizada da bancada, com os scripts
// do SIGAA). O que o Gravar enviaria aparece neste terminal.
//
// Nada sai da máquina: toda outra requisição é recusada. O perfil do Chrome é
// próprio (em fora-do-git/, ignorado pelo git), e a base do Adsum dele não é a sua.
//
// Uso:
//   npm run demonstracao [-- --professor "NOME"] [--versao REF] [--perfil PASTA]
// Precisa da página da bancada em fora-do-git/bancada-sigaa, na pasta
// principal do repositório (ou ADSUM_BANCADA).

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'
import { chromium } from '@playwright/test'
import { atenderEnderecos, SIGAA, SITE } from '../e2e/apoio/enderecos.ts'
import { versao } from '../e2e/apoio/versoes.ts'
import { FORA_DO_GIT } from './foraDoGit.mjs'
import { alunosDaBancada, codigoDaBancada, paginaDeParticipantes } from '../e2e/apoio/turmaDaBancada.ts'

const RAIZ = resolve(import.meta.dirname, '..')
const BANCADA = 'http://localhost:8080'
const PARTICIPANTES = 'https://sigaa.ufpe.br/sigaa/ava/participantes.jsf'

const argumentos = process.argv.slice(2)
const opcao = (nome, padrao) => {
  const i = argumentos.indexOf(`--${nome}`)
  return i >= 0 ? argumentos[i + 1] : padrao
}
const PASTA_DA_BANCADA = resolve(RAIZ, process.env.ADSUM_BANCADA ?? join(FORA_DO_GIT, 'bancada-sigaa'))
const PERFIL = resolve(RAIZ, opcao('perfil', join(FORA_DO_GIT, 'demonstracao-chrome')))
const PROFESSOR = opcao('professor', 'HELENA DUARTE LIMA')
const REFERENCIA = opcao('versao', 'HEAD')


/** O crachá inventado número `n`, como o dongle imprime: decimal de 10 dígitos. */
const crachaInventado = (n) => String(0xd1000000 + n).padStart(10, '0')

const escapar = (t) => t.replaceAll('&', '&amp;').replaceAll('<', '&lt;')

/** A página de participantes, com a lista no texto que o professor copia do SIGAA. */
export function htmlDeParticipantes(codigo, texto) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>SIGAA - Sistema Integrado de Gestão de Atividades Acadêmicas</title>
<style>
  body { margin: 0; font: 13px Verdana, Arial, sans-serif; background: #f1f1f1; color: #222 }
  header { background: #2c5a8c; color: #fff; padding: 10px 16px; font-weight: bold }
  nav { background: #dfe8f3; padding: 6px 16px; border-bottom: 1px solid #b8c8dc }
  main { margin: 16px; background: #fff; border: 1px solid #c8c8c8; padding: 12px 16px }
  h2 { font-size: 14px; color: #2c5a8c; margin: 0 0 10px }
  pre { font: inherit; white-space: pre-wrap; margin: 0; line-height: 1.6 }
  a { color: #2c5a8c }
</style></head><body>
<header>SIGAA · Sistema Integrado de Gestão de Atividades Acadêmicas</header>
<nav>${escapar(codigo)} › Turma › Participantes · <a href="${SIGAA}">Lançar Frequência (planilha)</a></nav>
<main><h2>Participantes</h2><pre>${escapar(texto)}</pre></main>
</body></html>`
}

/** A planilha da bancada sem o botão "Favorito (ensaio)": aqui, o favorito é o da barra. */
export const semBotaoDeEnsaio = (html) => html.replace(/<div id="bancada"[\s\S]*?<\/script>/, '')

async function bancadaNoAr() {
  try {
    return (await fetch(`${BANCADA}/bancada/registros`)).ok
  } catch {
    return false
  }
}

async function subirBancada() {
  if (await bancadaNoAr()) {
    console.log('  bancada já estava no ar em :8080 (o que o Gravar enviar aparece no terminal dela)')
    return
  }
  const filho = spawn(process.execPath, [join(RAIZ, 'scripts/bancada_sigaa.mjs'), PASTA_DA_BANCADA], { stdio: ['ignore', 'inherit', 'inherit'] })
  process.on('exit', () => filho.kill())
  for (let i = 0; i < 50 && !(await bancadaNoAr()); i++) await new Promise((r) => setTimeout(r, 100))
}

const AJUDA = `
Comandos:
  c 1 2 3        encosta os crachás inventados 1, 2 e 3 na janela do Adsum
  dia 2026-10-13 [08:00]   o Chrome vai para esse dia (e hora), e o Adsum recarrega
  hoje           volta ao relógio de verdade
  sigaa          a planilha volta ao que era (desfaz os Gravar da demonstração)
  ajuda, sair
`

async function main() {
  if (!existsSync(join(PASTA_DA_BANCADA, 'planilha.html'))) {
    console.error(`Sem a página da bancada em ${PASTA_DA_BANCADA} (ADSUM_BANCADA).`)
    process.exit(2)
  }
  console.log('SIGAA de demonstração')
  await subirBancada()
  console.log(`  montando o Adsum de ${REFERENCIA} (a primeira vez demora)…`)
  const v = versao(REFERENCIA)
  console.log(`  Adsum ${v.commit.slice(0, 7)}, perfil do Chrome em ${PERFIL}`)

  const alunos = alunosDaBancada(PASTA_DA_BANCADA)
  const codigo = codigoDaBancada(PASTA_DA_BANCADA)
  const participantes = htmlDeParticipantes(codigo, paginaDeParticipantes(PROFESSOR, alunos))

  const contexto = await chromium.launchPersistentContext(PERFIL, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    serviceWorkers: 'block',
    // Sem a faixa "controlado por software de teste": é uma demonstração.
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--start-maximized'],
  })
  contexto.on('close', () => process.exit(0))
  await atenderEnderecos(contexto, v)
  // Registrada depois, responde antes: a página de participantes, e a planilha
  // sem o botão de ensaio da bancada (aqui, o favorito é o da barra).
  await contexto.route('https://sigaa.ufpe.br/**', async (rota) => {
    const url = new URL(rota.request().url())
    if (url.pathname === new URL(PARTICIPANTES).pathname) {
      return rota.fulfill({ body: participantes, contentType: 'text/html; charset=utf-8' })
    }
    if (url.pathname === '/sigaa/ava/index.jsf' && rota.request().method() === 'GET') {
      const resposta = await rota.fetch({ url: `${BANCADA}${url.pathname}${url.search}` })
      const corpo = semBotaoDeEnsaio(await resposta.text())
      return rota.fulfill({ response: resposta, body: corpo })
    }
    return rota.fallback()
  })

  const [primeira] = contexto.pages()
  const adsum = primeira ?? (await contexto.newPage())
  await adsum.goto(SITE)
  await (await contexto.newPage()).goto(PARTICIPANTES)
  await (await contexto.newPage()).goto(SIGAA)
  await adsum.bringToFront()

  console.log(`
  Abas: o Adsum, os participantes de ${codigo} (${alunos.length} alunos inventados) e a planilha.
  Barra de favoritos: ⇧⌘B. O favorito vem de Ajustes › Lançar no SIGAA, no Adsum.
  Crachás: o dongle de verdade funciona; sem ele, os inventados abaixo.
${AJUDA}`)

  /** A janela do Adsum mais recente (não a folha que o favorito abre). */
  const janelaDoAdsum = () =>
    contexto
      .pages()
      .filter((p) => p.url().startsWith(SITE) && !p.url().includes('#/sigaa'))
      .at(-1)

  const terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: 'demonstração> ' })
  terminal.prompt()
  for await (const linha of terminal) {
    const [comando, ...resto] = linha.trim().split(/\s+/)
    try {
      if (comando === 'c' || comando === 'cracha') {
        const pagina = janelaDoAdsum()
        if (!pagina) throw new Error('nenhuma janela do Adsum aberta')
        await pagina.bringToFront()
        for (const n of resto.map(Number).filter((n) => Number.isInteger(n) && n > 0)) {
          await pagina.keyboard.type(crachaInventado(n), { delay: 8 })
          await pagina.keyboard.press('Enter')
          // Acima do intervalo mínimo entre crachás diferentes (400 ms).
          await pagina.waitForTimeout(600)
        }
      } else if (comando === 'dia') {
        const [data, hora = '10:00'] = resto
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) throw new Error('use: dia AAAA-MM-DD [HH:MM]')
        await contexto.clock.setSystemTime(new Date(`${data}T${hora}:00-03:00`))
        for (const p of contexto.pages().filter((p) => p.url().startsWith(SITE))) await p.reload()
        console.log(`  o Chrome está em ${data} ${hora}`)
      } else if (comando === 'hoje') {
        await contexto.clock.setSystemTime(new Date())
        for (const p of contexto.pages().filter((p) => p.url().startsWith(SITE))) await p.reload()
      } else if (comando === 'sigaa') {
        await fetch(`${BANCADA}/bancada/reiniciar`, { method: 'POST' })
        for (const p of contexto.pages().filter((p) => p.url().startsWith('https://sigaa.ufpe.br/sigaa/ava/index.jsf'))) await p.goto(SIGAA)
        console.log('  a planilha voltou ao que era')
      } else if (comando === 'sair') {
        break
      } else if (comando) {
        console.log(AJUDA)
      }
    } catch (erro) {
      console.log(`  ${erro.message}`)
    }
    if (!terminal.closed) terminal.prompt()
  }
  terminal.close()
  await contexto.close()
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
