// As duas pontas da mudança, cada uma com a sua base: a ponte no endereço
// antigo e a chegada no novo. O `postMessage` entre as janelas é simulado com
// a origem de cada lado, e tudo o mais é de verdade: Dexie, restauração, telas.

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepositorioDexie } from '../adaptadores/repositorio/RepositorioDexie.ts'
import { restaurar } from '../ambiente/restauracao.ts'
import { resumoDaBase } from '../ambiente/mudanca.ts'
import { AULA_2209, pastaDoCofre } from '../testes/cofreDeTeste.ts'
import type { Mudanca } from '../nucleo/endereco.ts'
import { Chegada } from '../ui/Chegada.tsx'
import { TelaPonte } from './TelaPonte.tsx'

const MUDANCA: Mudanca = {
  de: { origem: 'https://antigo.exemplo.com', caminho: '/adsum/' },
  para: { origem: 'https://novo.exemplo.com', caminho: '/' },
}

let n = 0
async function base(cofre = false) {
  const repositorio = new RepositorioDexie(`adsum-ponte-${n++}`)
  await repositorio.abrir()
  if (cofre) await restaurar(repositorio, (await pastaDoCofre(AULA_2209)).handle)
  return repositorio
}

/** Uma mensagem chegando a esta janela, vinda de `origem`. */
const vindaDe = (origem: string) => (data: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { data, origin: origem }))

function montarAsDuas(antigo: RepositorioDexie, novo: RepositorioDexie, opcoes: { bloqueado?: boolean } = {}) {
  const abertas: string[] = []
  const abrirJanela = (url: string) => {
    abertas.push(url)
    if (opcoes.bloqueado) return null
    render(
      <Chegada
        abrirRepositorio={async () => novo}
        ponte={{ postMessage: vindaDe(MUDANCA.para.origem) }}
        origemDaPonte={MUDANCA.de.origem}
        abrirApp={() => {}}
      />,
    )
    return { postMessage: vindaDe(MUDANCA.de.origem) }
  }
  render(<TelaPonte mudanca={MUDANCA} abrirRepositorio={async () => antigo} abrirJanela={abrirJanela} hash="" soPeloBackup={false} />)
  return abertas
}

describe('a ponte', () => {
  it('leva a base para o endereço novo, e as duas pontas dizem o mesmo número', async () => {
    const antigo = await base(true)
    const novo = await base()
    const abertas = montarAsDuas(antigo, novo)

    await userEvent.click(await screen.findByRole('button', { name: 'Levar meus dados' }))

    expect(abertas).toEqual(['https://novo.exemplo.com/#/chegada'])
    expect(await screen.findByText('Seus dados estão no endereço novo')).toBeInTheDocument()
    expect(screen.getByText('Seus dados chegaram')).toBeInTheDocument()
    const resumo = await resumoDaBase(antigo)
    expect(await resumoDaBase(novo)).toEqual(resumo)
    expect(resumo.eventos).toBeGreaterThan(0)
    // O mesmo resumo nas duas janelas.
    expect(screen.getAllByText(new RegExp(`${resumo.vinculos} crachás`))).toHaveLength(2)
  })

  it('o endereço novo com dados não recebe nada, e a ponte diz isso', async () => {
    const antigo = await base(true)
    const novo = await base(true)
    const antes = await resumoDaBase(novo)
    montarAsDuas(antigo, novo)

    await userEvent.click(await screen.findByRole('button', { name: 'Levar meus dados' }))

    expect(await screen.findByText('O endereço novo já tinha seus dados')).toBeInTheDocument()
    expect(await resumoDaBase(novo)).toEqual(antes)
  })

  it('janela bloqueada pelo navegador é dita, e o botão continua lá', async () => {
    montarAsDuas(await base(true), await base(), { bloqueado: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Levar meus dados' }))
    expect(screen.getByText(/bloqueou a janela nova/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Levar meus dados' })).toBeInTheDocument()
  })

  it('mensagem de outra origem não é a chegada', async () => {
    const antigo = await base(true)
    render(
      <TelaPonte
        mudanca={MUDANCA}
        abrirRepositorio={async () => antigo}
        abrirJanela={() => ({ postMessage: () => {} })}
        hash=""
        soPeloBackup={false}
      />,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Levar meus dados' }))
    vindaDe('https://outro.exemplo.com')({ adsum: 'mudanca', tipo: 'recebido', desfecho: 'trazido', resumo: { turmas: 1, vinculos: 1, eventos: 1 }, problemas: [] })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Seus dados estão no endereço novo')).not.toBeInTheDocument()
    expect(screen.getByText('Abrindo o endereço novo.')).toBeInTheDocument()
  })

  it('base vazia só aponta o endereço novo', async () => {
    const idas: string[] = []
    render(<TelaPonte mudanca={MUDANCA} abrirRepositorio={async () => await base()} hash="" soPeloBackup={false} irPara={(u) => idas.push(u)} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir o Adsum' }))
    expect(idas).toEqual(['https://novo.exemplo.com/'])
    expect(screen.queryByRole('button', { name: 'Levar meus dados' })).not.toBeInTheDocument()
  })

  it('o app instalado no Safari leva pelo arquivo, não pela janela', async () => {
    const antigo = await base(true)
    render(<TelaPonte mudanca={MUDANCA} abrirRepositorio={async () => antigo} hash="" soPeloBackup />)
    expect(await screen.findByRole('button', { name: 'Baixar o backup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Levar meus dados' })).not.toBeInTheDocument()
  })

  it('o favorito antigo do SIGAA aponta o endereço novo', async () => {
    const idas: string[] = []
    render(<TelaPonte mudanca={MUDANCA} abrirRepositorio={async () => await base(true)} hash="#/sigaa" soPeloBackup={false} irPara={(u) => idas.push(u)} />)
    expect(screen.getByText('Favorito antigo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o Adsum' }))
    expect(idas).toEqual(['https://novo.exemplo.com/'])
  })
})

describe('a chegada', () => {
  it('aberta à mão, sem a ponte, diz de onde abrir', () => {
    render(<Chegada abrirRepositorio={async () => { throw new Error('não deveria abrir a base') }} ponte={null} />)
    expect(screen.getByText('Abra pelo endereço antigo')).toBeInTheDocument()
  })

  it('não aceita o cofre de outra origem', async () => {
    const novo = await base()
    render(<Chegada abrirRepositorio={async () => novo} ponte={{ postMessage: () => {} }} origemDaPonte={MUDANCA.de.origem} />)
    vindaDe('https://outro.exemplo.com')({ adsum: 'mudanca', tipo: 'cofre', arquivos: [{ caminho: 'vinculos.json', texto: '{"versao":1,"conteudo":[]}' }] })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('Recebendo seus dados')).toBeInTheDocument()
    await waitFor(async () => expect(await resumoDaBase(novo)).toEqual({ turmas: 0, vinculos: 0, eventos: 0 }))
  })
})
