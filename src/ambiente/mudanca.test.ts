// A mudança de endereço sobre base com histórico: a aula de 22/09/2026, com
// `evento_id` repetido e duas turmas, mais a auditoria do SIGAA. O que se
// confere é o que o professor perderia: cada tabela, o sal e o chaveiro.

import { describe, expect, it } from 'vitest'
import { RepositorioDexie } from '../adaptadores/repositorio/RepositorioDexie.ts'
import { AULA_2209, pastaDoCofre } from '../testes/cofreDeTeste.ts'
import { saisConhecidos } from '../nucleo/hash.ts'
import { NOME_DO_BACKUP, deJsonBackup, lerMensagem, paraJsonBackup } from '../nucleo/mudanca.ts'
import { comoDia, type LinhaDeAuditoria } from '../nucleo/lancar/tipos.ts'
import type { Repositorio } from '../portas/Repositorio.ts'
import { arquivosDoCofre, receberMudanca, resumoDaBase } from './mudanca.ts'
import { restaurar, restaurarDeArquivos } from './restauracao.ts'

let n = 0
async function base(nome: string) {
  const repositorio = new RepositorioDexie(`adsum-${nome}-${n++}`)
  await repositorio.abrir()
  return repositorio
}

const linha = (turma: string, acao: LinhaDeAuditoria['acao'], aplicado: string): LinhaDeAuditoria => ({
  turma,
  quando: '2026-10-22T11:40:00.000Z',
  acao,
  versaoSigaa: 'sigaa-4.x',
  dia: comoDia('2026-09-22')!,
  matricula: '20269900001',
  lido: '0',
  proposto: '2',
  aplicado,
})

/** O endereço antigo: a base de um professor na segunda semana, e uma aula já lançada no SIGAA. */
async function enderecoAntigo() {
  const antigo = await base('antigo')
  await restaurar(antigo, (await pastaDoCofre(AULA_2209)).handle)
  const [turma] = await antigo.listarTurmas()
  await antigo.acrescentarAuditoriaSigaa([linha(turma, 'preenchimento', '2'), linha(turma, 'aceite', '0')])
  await antigo.gravarAjusteSigaa({ turma, dia: comoDia('2026-09-22')!, matricula: '20269900001', valor: 0, em: '2026-10-22T11:40:00.000Z' })
  // Um sal antigo no chaveiro, como depois de restaurar o cofre de outro professor.
  await antigo.lembrarSais(['ab'.repeat(16)])
  return { antigo, turma }
}

async function retrato(r: Repositorio) {
  const config = await r.lerConfig()
  const turmas = await r.listarTurmas()
  const porId = <T extends { eventoId: string }>(l: T[]) => [...l].sort((a, b) => a.eventoId.localeCompare(b.eventoId))
  const semId = <T extends object>(l: T[]) => l.map((x) => ({ ...x, id: undefined }))
  return {
    sal: config.salHex,
    vinculos: [...(await r.listarVinculos())].sort((a, b) => a.uidHash.localeCompare(b.uidHash)),
    matriculados: await r.listarMatriculados(),
    aulas: semId(await r.listarAulas()),
    eventos: porId(await r.listarEventos()),
    auditoria: await Promise.all(turmas.map((t) => r.listarAuditoriaSigaa(t))).then((l) => semId(l.flat())),
    ajustes: semId(await r.lerAjustesSigaa()),
  }
}

/**
 * O chaveiro do novo é o do antigo mais o sal que o novo sorteou ao abrir:
 * nenhum sal é descartado, nem o de uma base vazia.
 */
async function chaveiroChegou(novo: Repositorio, salDoNovo: string, antigo: Repositorio) {
  const doAntigo = saisConhecidos(await antigo.lerConfig())
  expect([...saisConhecidos(await novo.lerConfig())].sort()).toEqual([...new Set([...doAntigo, salDoNovo])].sort())
}

describe('levar a base para o endereço novo', () => {
  it('chega tudo: cadastro, chamadas com id repetido, grade, auditoria e o chaveiro inteiro', async () => {
    const { antigo } = await enderecoAntigo()
    // O defeito de 22/09 deixou ids repetidos no arquivo; na base, o segundo é `.2`.
    expect((await antigo.listarEventos()).some((e) => /\.\d+$/.test(e.eventoId))).toBe(true)
    const novo = await base('novo')
    const { salHex: salDoNovo } = await novo.lerConfig()

    const { desfecho, resumo, problemas } = await receberMudanca(novo, await arquivosDoCofre(antigo))

    expect(problemas).toEqual([])
    expect(desfecho).toBe('trazido')
    expect(resumo).toEqual(await resumoDaBase(antigo))
    expect(await retrato(novo)).toEqual(await retrato(antigo))
    await chaveiroChegou(novo, salDoNovo, antigo)
  })

  it('o id da instalação não viaja: o endereço novo não cunha os números do antigo', async () => {
    const { antigo } = await enderecoAntigo()
    const novo = await base('novo')
    await receberMudanca(novo, await arquivosDoCofre(antigo))
    expect((await novo.lerConfig()).instalacaoId).not.toBe((await antigo.lerConfig()).instalacaoId)
  })

  it('o endereço novo com dados não recebe nada por cima, e o antigo fica como estava', async () => {
    const { antigo } = await enderecoAntigo()
    const arquivos = await arquivosDoCofre(antigo)
    const novo = await base('novo')
    await receberMudanca(novo, arquivos)
    const depoisDaPrimeira = await retrato(novo)

    const segunda = await receberMudanca(novo, arquivos)

    expect(segunda.desfecho).toBe('ja_tinha')
    expect(await retrato(novo)).toEqual(depoisDaPrimeira)
    expect(await retrato(antigo)).toEqual(depoisDaPrimeira)
  })

  it('o auditoria/uids.csv não sai do endereço antigo', async () => {
    const { antigo } = await enderecoAntigo()
    expect((await arquivosDoCofre(antigo)).map((a) => a.caminho).filter((c) => c.startsWith('auditoria/'))).toEqual([])
  })
})

describe('o backup em arquivo, para quem leva à mão', () => {
  const comoArquivo = (nome: string, texto: string) => ({ name: nome, webkitRelativePath: '', text: async () => texto }) as File

  it('abre na restauração de arquivos de sempre, e chega o mesmo que pela janela', async () => {
    const { antigo } = await enderecoAntigo()
    const novo = await base('backup')
    const { salHex: salDoNovo } = await novo.lerConfig()

    const { problemas } = await restaurarDeArquivos(novo, [comoArquivo(NOME_DO_BACKUP, paraJsonBackup(await arquivosDoCofre(antigo)))])

    expect(problemas).toEqual([])
    expect(await retrato(novo)).toEqual(await retrato(antigo))
    await chaveiroChegou(novo, salDoNovo, antigo)
  })

  it('JSON que não é backup não é lido como backup', () => {
    expect(deJsonBackup('{"versao":1,"conteudo":[]}')).toBeUndefined()
    expect(deJsonBackup('não é json')).toBeUndefined()
  })

  it('backup de versão mais nova é recusado com o motivo, sem ler nada', () => {
    const texto = paraJsonBackup([{ caminho: 'config.json', texto: '{}' }]).replace('"versao": 1', '"versao": 99')
    expect(deJsonBackup(texto)).toEqual({ arquivos: [], problemas: [expect.stringContaining('versão mais nova')] })
  })

  it('arquivo de dentro com caminho que sai da pasta fica de fora, e é dito', () => {
    const texto = paraJsonBackup([
      { caminho: 'config.json', texto: '{}' },
      { caminho: '../fora.json', texto: '{}' },
    ])
    const lido = deJsonBackup(texto)!
    expect(lido.arquivos.map((a) => a.caminho)).toEqual(['config.json'])
    expect(lido.problemas).toEqual([expect.stringContaining('1 arquivo(s)')])
  })
})

describe('a conversa entre as janelas', () => {
  const ANTIGA = 'https://antiga.exemplo.com'

  it('só aceita a origem esperada', () => {
    expect(lerMensagem({ origin: ANTIGA, data: { adsum: 'mudanca', tipo: 'pronta' } }, ANTIGA)).toEqual({ adsum: 'mudanca', tipo: 'pronta' })
    expect(lerMensagem({ origin: 'https://outra.exemplo.com', data: { adsum: 'mudanca', tipo: 'pronta' } }, ANTIGA)).toBeUndefined()
  })

  it('recusa forma estranha e caminho que sai da pasta', () => {
    const cofre = (caminho: string) => ({ origin: ANTIGA, data: { adsum: 'mudanca', tipo: 'cofre', arquivos: [{ caminho, texto: '' }] } })
    expect(lerMensagem(cofre('turmas/X.json'), ANTIGA)?.tipo).toBe('cofre')
    for (const ruim of ['../config.json', '/config.json', 'turmas//X.json', '']) expect(lerMensagem(cofre(ruim), ANTIGA)).toBeUndefined()
    expect(lerMensagem({ origin: ANTIGA, data: { adsum: 'mudanca', tipo: 'cofre', arquivos: 'x' } }, ANTIGA)).toBeUndefined()
    expect(lerMensagem({ origin: ANTIGA, data: { adsum: 'outra', tipo: 'pronta' } }, ANTIGA)).toBeUndefined()
    expect(lerMensagem({ origin: ANTIGA, data: null }, ANTIGA)).toBeUndefined()
  })
})
