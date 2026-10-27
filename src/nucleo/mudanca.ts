// A mudança de endereço (`docs/14_casa_nova.md`): a ponte, no endereço antigo,
// entrega a base ao app no endereço novo, de janela para janela.
//
// O que viaja é a pasta que a base escreveria (`config.json`, vínculos, grade,
// turmas, registros e a auditoria do SIGAA), e o endereço novo a lê com a
// mesma restauração dos arquivos soltos. Um formato só para pasta, backup e
// mudança: o que restaura um restaura os outros.

import { VERSAO } from './cofre.ts'

/** Um arquivo do cofre, pelo caminho dentro da pasta (`turmas/X.json`). */
export interface ArquivoDoCofre {
  caminho: string
  texto: string
}

/** Quanto a base tem, para os dois lados dizerem o mesmo número. */
export interface ResumoDaBase {
  turmas: number
  vinculos: number
  eventos: number
}

export const baseVazia = (r: ResumoDaBase) => r.turmas === 0 && r.vinculos === 0 && r.eventos === 0

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "2 turmas, 48 crachás e 310 registros de chamada." O mesmo texto nos dois endereços. */
export function descreverResumo(r: ResumoDaBase): string {
  return `${plural(r.turmas, 'turma', 'turmas')}, ${plural(r.vinculos, 'crachá', 'crachás')} e ${plural(r.eventos, 'registro', 'registros')} de chamada.`
}

/**
 * `trazido`: entrou. `ja_tinha`: o endereço novo já tinha dados (a pasta foi
 * escolhida antes, ou a mudança já foi feita) e nada foi tocado, porque juntar
 * duas bases por cima duplicaria a grade. `falhou`: deu erro ao gravar.
 */
export type Desfecho = 'trazido' | 'ja_tinha' | 'falhou'

export type MensagemDaMudanca =
  /** O app novo está pronto para receber. Vai do endereço novo para a ponte. */
  | { adsum: 'mudanca'; tipo: 'pronta' }
  | { adsum: 'mudanca'; tipo: 'cofre'; arquivos: ArquivoDoCofre[] }
  | { adsum: 'mudanca'; tipo: 'recebido'; desfecho: Desfecho; resumo: ResumoDaBase; problemas: string[] }

const ehTexto = (x: unknown): x is string => typeof x === 'string'
const ehNumero = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

function ehArquivo(x: unknown): x is ArquivoDoCofre {
  const a = x as ArquivoDoCofre
  return !!a && ehTexto(a.caminho) && ehTexto(a.texto) && caminhoSeguro(a.caminho)
}

/** Relativo, sem `..` nem barra no começo: o caminho vem de outra janela. */
export const caminhoSeguro = (caminho: string) =>
  caminho.length > 0 && !caminho.startsWith('/') && caminho.split('/').every((p) => p !== '' && p !== '.' && p !== '..')

function ehResumo(x: unknown): x is ResumoDaBase {
  const r = x as ResumoDaBase
  return !!r && ehNumero(r.turmas) && ehNumero(r.vinculos) && ehNumero(r.eventos)
}

/**
 * A mensagem, se ela veio da origem esperada e tem a forma certa. Qualquer
 * outra coisa (outra origem, outra extensão falando com a janela, forma
 * estranha) é ignorada calada: não é conversa com a gente.
 */
export function lerMensagem(evento: { origin: string; data: unknown }, origemEsperada: string): MensagemDaMudanca | undefined {
  if (evento.origin !== origemEsperada) return undefined
  const m = evento.data as Partial<Record<string, unknown>>
  if (!m || m.adsum !== 'mudanca') return undefined
  if (m.tipo === 'pronta') return { adsum: 'mudanca', tipo: 'pronta' }
  if (m.tipo === 'cofre' && Array.isArray(m.arquivos) && m.arquivos.every(ehArquivo)) {
    return { adsum: 'mudanca', tipo: 'cofre', arquivos: m.arquivos }
  }
  if (
    m.tipo === 'recebido' &&
    (m.desfecho === 'trazido' || m.desfecho === 'ja_tinha' || m.desfecho === 'falhou') &&
    ehResumo(m.resumo) &&
    Array.isArray(m.problemas) &&
    m.problemas.every(ehTexto)
  ) {
    return { adsum: 'mudanca', tipo: 'recebido', desfecho: m.desfecho, resumo: m.resumo, problemas: m.problemas }
  }
  return undefined
}

/** O backup da ponte: um arquivo só, para quem leva os dados à mão. */
export const NOME_DO_BACKUP = 'adsum-backup.json'

/** Marca do arquivo, para a restauração reconhecê-lo sem depender do nome. */
const TIPO_DO_BACKUP = 'adsum-backup'

export function paraJsonBackup(arquivos: ArquivoDoCofre[]): string {
  return JSON.stringify({ tipo: TIPO_DO_BACKUP, versao: VERSAO, gravadoEm: new Date().toISOString(), arquivos }, null, 2) + '\n'
}

/**
 * Os arquivos de dentro do backup, ou `undefined` se o texto não é um backup.
 * Um backup com arquivo que não serve diz qual, e os outros entram.
 */
export function deJsonBackup(texto: string): { arquivos: ArquivoDoCofre[]; problemas: string[] } | undefined {
  let cru: { tipo?: unknown; versao?: unknown; arquivos?: unknown }
  try {
    cru = JSON.parse(texto)
  } catch {
    return undefined
  }
  if (cru?.tipo !== TIPO_DO_BACKUP) return undefined
  if (typeof cru.versao !== 'number' || cru.versao > VERSAO) {
    return {
      arquivos: [],
      problemas: [`${NOME_DO_BACKUP} foi gravado por uma versão mais nova do Adsum. Atualize o Adsum antes de abri-lo.`],
    }
  }
  const lista = Array.isArray(cru.arquivos) ? cru.arquivos : []
  const arquivos = lista.filter(ehArquivo)
  const problemas = lista.length === arquivos.length ? [] : [`${NOME_DO_BACKUP}: ${lista.length - arquivos.length} arquivo(s) sem a forma esperada, ficaram de fora.`]
  return { arquivos, problemas }
}
