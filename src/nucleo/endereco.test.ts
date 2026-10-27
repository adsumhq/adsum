/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMINHO, GUIA_URL, ORIGEM, REPOSITORIO_URL, SITE } from './endereco.ts'

// Mudar de casa é trocar `endereco.ts`. Um endereço escrito à mão noutro arquivo
// sobreviveria à mudança e apontaria para a casa velha sem ninguém ver: no
// favorito, isso abre uma janela que não existe.
const ONDE_PROCURAR = ['src', 'e2e', 'scripts', 'public', 'index.html', 'vite.config.ts', '.github']

describe('o endereço do Adsum', () => {
  it('só aparece em endereco.ts', () => {
    const host = new URL(ORIGEM).host
    const repositorio = new URL(REPOSITORIO_URL).pathname.slice(1)
    const arquivos = execFileSync('git', ['ls-files', '--', ...ONDE_PROCURAR], { encoding: 'utf-8' })
      .split('\n')
      .filter((f) => f && f !== 'src/nucleo/endereco.ts' && !/\.(png|jpg|ico|woff2?)$/.test(f))

    const achados = arquivos.flatMap((arquivo) =>
      readFileSync(arquivo, 'utf-8')
        .split('\n')
        .flatMap((linha, i) => (linha.includes(host) || linha.includes(repositorio) ? [`${arquivo}:${i + 1}`] : [])),
    )
    expect(achados).toEqual([])
  })

  it('o site é a origem com o caminho, e o caminho serve de base do Vite', () => {
    expect(CAMINHO).toMatch(/^\/(.+\/)?$/)
    expect(SITE).toBe(`${new URL(ORIGEM).origin}${CAMINHO}`)
    expect(GUIA_URL.startsWith('https://raw.githubusercontent.com/')).toBe(true)
  })
})
