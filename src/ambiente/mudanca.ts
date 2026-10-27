// Os dois lados da mudança de endereço que mexem na base: o que a ponte
// entrega e o que o endereço novo recebe. A conversa entre as janelas está em
// `nucleo/mudanca.ts`; as telas, em `ponte/` e `ui/Chegada.tsx`.

import { cabecalhoDaAuditoria, linhaDaAuditoria } from '../nucleo/lancar/auditoria.ts'
import { paraCsv, porTurma } from '../nucleo/csv.ts'
import { baseVazia, type ArquivoDoCofre, type Desfecho, type ResumoDaBase } from '../nucleo/mudanca.ts'
import type { Repositorio } from '../portas/Repositorio.ts'
import { restaurarDoCofre } from './restauracao.ts'
import { arquivosDoCadastro, caminhoDaAuditoriaSigaa, caminhoDosRegistros } from './sincronia.ts'

export async function resumoDaBase(repositorio: Repositorio): Promise<ResumoDaBase> {
  const [turmas, vinculos, eventos] = await Promise.all([
    repositorio.listarTurmas(),
    repositorio.listarVinculos(),
    repositorio.contarEventos(),
  ])
  return { turmas: turmas.length, vinculos: vinculos.length, eventos }
}

/**
 * A pasta que a base escreveria, inteira: o cadastro, o log de cada turma
 * e a auditoria do SIGAA. É tudo o que a base tem que a pasta também guarda,
 * e por isso a restauração dos arquivos soltos a lê sem caso especial. O
 * `auditoria/uids.csv` não vai: mora só na pasta, e não sai dela.
 */
export async function arquivosDoCofre(repositorio: Repositorio): Promise<ArquivoDoCofre[]> {
  const arquivos = await arquivosDoCadastro(repositorio)

  // Mais antigos primeiro, como o log cresce. Evento de id derivado (`.2`) vai
  // com o id da base: é a base que viaja, não a pasta.
  const eventos = [...(await repositorio.listarEventos())].reverse()
  const turmas = new Set(await repositorio.listarTurmas())
  for (const [turma, linhas] of porTurma(eventos)) {
    turmas.add(turma)
    arquivos.push({ caminho: caminhoDosRegistros(turma), texto: paraCsv(linhas) })
  }

  for (const turma of turmas) {
    const linhas = await repositorio.listarAuditoriaSigaa(turma)
    if (linhas.length === 0) continue
    arquivos.push({
      caminho: caminhoDaAuditoriaSigaa(turma),
      texto: cabecalhoDaAuditoria() + linhas.map((l) => linhaDaAuditoria(l) + '\n').join(''),
    })
  }
  return arquivos
}

/**
 * Recebe a base do endereço antigo. **Só em base vazia:** se a pasta já foi
 * escolhida aqui, ou a mudança já foi feita, os dados já estão, e restaurar
 * por cima duplicaria a grade (aula não tem chave natural). Nada é apagado
 * de nenhum dos lados.
 */
export async function receberMudanca(
  repositorio: Repositorio,
  arquivos: ArquivoDoCofre[],
): Promise<{ desfecho: Desfecho; resumo: ResumoDaBase; problemas: string[] }> {
  const antes = await resumoDaBase(repositorio)
  if (!baseVazia(antes)) return { desfecho: 'ja_tinha', resumo: antes, problemas: [] }
  try {
    const { problemas } = await restaurarDoCofre(repositorio, arquivos)
    return { desfecho: 'trazido', resumo: await resumoDaBase(repositorio), problemas }
  } catch (erro) {
    return { desfecho: 'falhou', resumo: await resumoDaBase(repositorio), problemas: [(erro as Error).message] }
  }
}
