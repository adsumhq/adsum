#!/usr/bin/env node
// O zip da pasta do professor, lido como o `docs/07` (§5) manda: o diário de
// cada dia, com o que é problema separado do que é sabido. Imprime só
// contagens, tempos, versões e nomes de turma; nenhum nome de aluno,
// matrícula, hash ou UID sai daqui. O zip não é copiado para lugar nenhum:
// é aberto numa pasta temporária, lido e apagado.
//
// Uso:
//   npm run ler-zip -- ARQUIVO.zip [--desde AAAA-MM-DD]
// Sem `--desde`, julga os 7 dias até o último dia com diário; os anteriores
// aparecem só como contexto. Sai com código 1 se houver problema.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Os piores tempos por crachá de 24/09, a primeira aula limpa (`docs/07`, §5). */
const REFERENCIA_MS = { identificar_ms: 13, gravar_ms: 7, tela_ms: 48 }
/** Folga sobre a referência antes de chamar de lento: a máquina e a turma mudam. */
const FOLGA = 3

const argumentos = process.argv.slice(2)
const i = argumentos.indexOf('--desde')
const desdePedido = i >= 0 ? argumentos[i + 1] : undefined
const zip = argumentos.find((a, k) => !a.startsWith('--') && argumentos[k - 1] !== '--desde')
if (!zip || !existsSync(zip)) {
  console.error('Uso: npm run ler-zip -- ARQUIVO.zip [--desde AAAA-MM-DD]')
  process.exit(2)
}

const temporaria = mkdtempSync(join(tmpdir(), 'adsum-zip-'))
process.on('exit', () => rmSync(temporaria, { recursive: true, force: true }))
execFileSync('unzip', ['-q', '-o', zip, '-d', temporaria])

/** A pasta do Adsum dentro do zip: a que tem `diagnostico/`, fora do lixo do macOS. */
function acharPasta(dir) {
  if (existsSync(join(dir, 'diagnostico'))) return dir
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (nome !== '__MACOSX' && statSync(caminho).isDirectory()) {
      const achada = acharPasta(caminho)
      if (achada) return achada
    }
  }
  return undefined
}
const pasta = acharPasta(temporaria)
if (!pasta) {
  console.error('O zip não tem a pasta diagnostico/: não parece ser a pasta do Adsum.')
  process.exit(2)
}

const lerLinha = (linha) => {
  const [hora, evento, ...pares] = linha.split(' | ')
  return { hora, evento, campos: Object.fromEntries(pares.map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)])) }
}
const dias = readdirSync(join(pasta, 'diagnostico'))
  .filter((n) => /^\d{4}-\d{2}-\d{2}\.log$/.test(n))
  .sort()
  .map((n) => ({
    dia: n.slice(0, 10),
    linhas: readFileSync(join(pasta, 'diagnostico', n), 'utf-8').split('\n').filter(Boolean).map(lerLinha),
  }))
if (dias.length === 0) {
  console.error('Nenhum diário em diagnostico/.')
  process.exit(2)
}

const ultimo = dias.at(-1).dia
const desde = desdePedido ?? new Date(Date.parse(`${ultimo}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10)

/** Os repetidos de cada turma no primeiro diário: a linha de base, que não pode crescer. */
const base = new Map()
for (const { linhas } of dias) {
  for (const l of linhas) if (l.evento === 'conferencia_divergiu' && !base.has(l.campos.turma)) base.set(l.campos.turma, Number(l.campos.repetidos ?? 0))
}

const PROBLEMA = (e) => e.startsWith('erro') || ['id_ocupado', 'recusa', 'desconhecido_durante_busca', 'busca_desistiu', 'leituras_sem_chamada'].includes(e)
let problemas = 0
const curta = (turma) => /([A-Z]{2,6}\d{2,5})/.exec(turma ?? '')?.[1] ?? turma

console.log(`\n  ${zip}`)
console.log(`  ${dias.length} dias com diário, de ${dias[0].dia} a ${ultimo}. Julgados: desde ${desde}.\n`)

for (const { dia, linhas } of dias) {
  const julgado = dia >= desde
  const contagem = new Map()
  for (const l of linhas) contagem.set(l.evento, (contagem.get(l.evento) ?? 0) + 1)
  const versoes = [...new Set(linhas.filter((l) => l.evento === 'app_aberto').map((l) => l.campos.versao))]
  const chamadas = linhas.filter((l) => l.evento === 'encerrar').map((l) => `${l.campos.presentes} presentes`)
  console.log(`  ${julgado ? '●' : '○'} ${dia}  versão ${versoes.join(', ') || '?'}  ·  ${contagem.get('cracha') ?? 0} crachás  ·  chamadas: ${chamadas.join(', ') || 'nenhuma encerrada'}`)
  if (!julgado) continue

  const achados = []
  for (const [evento, n] of contagem) if (PROBLEMA(evento)) achados.push(`${n}× ${evento}`)
  for (const l of linhas.filter((l) => l.evento === 'conferencia_divergiu')) {
    const c = l.campos
    const mexeu = Number(c.trazidos_para_base) + Number(c.renumerados) + Number(c.acrescentados_ao_arquivo)
    const cresceu = Number(c.repetidos ?? 0) > (base.get(c.turma) ?? 0)
    if (c.base !== c.arquivo || mexeu > 0 || cresceu) {
      achados.push(`conferência de ${curta(c.turma)} às ${c.hora ?? l.hora.slice(0, 5)}: base ${c.base}, arquivo ${c.arquivo}, trazidos ${c.trazidos_para_base}, renumerados ${c.renumerados}, acrescentados ${c.acrescentados_ao_arquivo}, repetidos ${c.repetidos}`)
    }
  }
  for (const [campo, referencia] of Object.entries(REFERENCIA_MS)) {
    const valores = linhas.filter((l) => l.evento === 'cracha' && l.campos[campo]).map((l) => Number(l.campos[campo]))
    const pior = valores.length ? Math.max(...valores) : 0
    if (pior > referencia * FOLGA) achados.push(`${campo} chegou a ${pior} (24/09: ${referencia})`)
  }
  const decisoes = new Map()
  for (const l of linhas.filter((l) => l.evento === 'cracha')) decisoes.set(l.campos.decisao, (decisoes.get(l.campos.decisao) ?? 0) + 1)
  const outras = [...decisoes].filter(([d]) => d !== 'presenca')
  if (outras.length) console.log(`      decisões além de presença: ${outras.map(([d, n]) => `${n}× ${d}`).join(', ')}`)
  const sigaa = contagem.get('conferencia_sigaa')
  if (sigaa) console.log(`      ${sigaa}× conferência com o SIGAA`)

  problemas += achados.length
  for (const a of achados) console.log(`      ✗ ${a}`)
}

const linhaDeBase = [...base].map(([t, n]) => `${curta(t)} ${n}`).join(', ')
console.log(`\n  Repetidos de antes (linha de base, não podem crescer): ${linhaDeBase || 'nenhum'}.`)
console.log(problemas === 0 ? '  Semana limpa pelo diário.\n' : `  ${problemas} achado(s) para ler antes de publicar.\n`)
process.exit(problemas === 0 ? 0 : 1)
