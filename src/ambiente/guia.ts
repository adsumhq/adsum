// O guia não vem embutido: é baixado da `main` na hora (`GUIA_URL`). É o
// único gesto do Adsum que usa a rede, e só quando o professor pede.

import { GUIA_URL } from '../nucleo/endereco.ts'
import { salvarBinario } from './arquivos.ts'

/** Baixa e salva o guia. Devolve o que dizer na tela, ou nada se cancelado. */
export async function baixarGuia(): Promise<string | undefined> {
  try {
    const resposta = await fetch(GUIA_URL)
    if (!resposta.ok) {
      throw new Error(
        `sem internet ou o arquivo mudou de lugar (HTTP ${resposta.status}). Baixe direto em ${GUIA_URL}`,
      )
    }
    const salvou = await salvarBinario('Adsum-guia.pdf', await resposta.blob())
    if (salvou === 'cancelado') return undefined
    return salvou === 'gravado'
      ? 'Guia gravado.'
      : 'O guia foi para a pasta de downloads. Este navegador não tem File System Access.'
  } catch (erro) {
    return (erro as Error).message
  }
}
