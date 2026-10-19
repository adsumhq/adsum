// O apelido da lista de alunos e o dongle dividem o mesmo teclado. O
// `LeitorTeclado` escuta a janela inteira, então um crachá lido com o cursor
// num apelido chega primeiro ao campo, até a rajada se reconhecer como crachá.
// Achado em 19/10/2026 numa chamada montada no Chrome: o apelido virou
// "Alice Moreira350", e, com crachá, esse nome é gravado ao sair do campo.
//
// Aqui o leitor é o `LeitorTeclado` de verdade, e não o simulado: o defeito
// mora na conversa entre ele e o campo.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montarBancada, renderizarCom, type Bancada } from '../../testes/montar.tsx'
import { TelaAula } from '../TelaAula.tsx'
import { LeitorTeclado } from '../../adaptadores/leitor/LeitorTeclado.ts'
import type { Leitura } from '../../portas/LeitorDeCracha.ts'
import type { Matriculado } from '../../nucleo/tipos.ts'

const TURMA = 'IF685 · T01'
const BRUNO: Matriculado = {
  turma: TURMA,
  chave: '20250000002',
  matricula: '20250000002',
  nome: 'Bruno Oliveira',
  nomeCompleto: 'BRUNO OLIVEIRA DA SILVA',
  papel: 'aluno',
}
const SESSAO = { turma: TURMA, abertaEm: new Date(Date.now() - 10 * 60_000).toISOString(), uidHashProfessor: 'professor' }

/** O crachá como o dongle medido em 10/09/2026 o imprime: decimal de 10 dígitos e Enter. */
const CRACHA = '0930148883'

let bancada: Bancada
let teclado: LeitorTeclado
let leituras: Leitura[]

beforeEach(async () => {
  bancada = await montarBancada()
  await bancada.repositorio.abrirSessao(SESSAO)
  window.localStorage.removeItem('adsum.chamada.lista')
  teclado = new LeitorTeclado()
  await teclado.iniciar()
  leituras = []
  teclado.aoLer((l) => leituras.push(l))
})

afterEach(async () => {
  await teclado.parar()
})

async function campoDoBruno() {
  renderizarCom(bancada, <TelaAula sessao={SESSAO} pendentes={[BRUNO]} daTurma={[BRUNO]} aoMudarBase={() => {}} />)
  return (await screen.findByLabelText(`nome de ${BRUNO.nomeCompleto}`)) as HTMLInputElement
}

describe('o apelido e o crachá no mesmo teclado', () => {
  it('um crachá lido com o cursor no apelido não muda o nome', async () => {
    const usuario = userEvent.setup({ delay: 8 })
    const campo = await campoDoBruno()
    await usuario.click(campo)
    await usuario.keyboard(`${CRACHA}{Enter}`)

    // O crachá foi lido, e o nome ficou como estava.
    expect(leituras).toHaveLength(1)
    expect(campo.value).toBe('Bruno Oliveira')
  })

  // Defeito conhecido, de 19/10/2026: o `LeitorTeclado` marca com
  // `preventDefault` a partir da quarta tecla de qualquer sequência com menos
  // de 400 ms entre elas, e não só no ritmo de máquina; o professor perde as
  // letras do apelido depois da terceira. O conserto é no leitor (caminho do
  // crachá, com o rig), não no campo. `it.fails` roda sempre: quando o leitor
  // for consertado, este teste passa a falhar e vira `it` de novo.
  it.fails('o professor digita o apelido no ritmo de uma pessoa, sem perder letras', async () => {
    const usuario = userEvent.setup({ delay: 150 })
    const campo = await campoDoBruno()
    await usuario.click(campo)
    await usuario.keyboard('{End} Junior')

    expect(campo.value).toBe('Bruno Oliveira Junior')
    expect(leituras).toHaveLength(0)
  })
})
