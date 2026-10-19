// O apelido e o dongle dividem o teclado. O `LeitorTeclado` escuta a janela
// inteira e só reconhece a rajada como crachá na quarta tecla: as três
// primeiras já caíram no campo com o cursor. Daí em diante ele marca as
// teclas com `preventDefault`, e é por esse sinal que o campo sabe que o que
// entrou não era do professor, e volta ao nome de antes da rajada.

import type { KeyboardEvent } from 'react'
import { INTERVALO_MAXIMO_MS } from '../../nucleo/digitacao.ts'

/** Um protetor por lista: lembra, por campo, o nome de antes da última sequência rápida de teclas. */
export function criarProtecaoDoCracha() {
  const porCampo = new Map<string, { em: number; antes: string }>()

  return (chave: string, valor: string, restaurar: (antes: string) => void) => (evento: KeyboardEvent<HTMLInputElement>) => {
    const agora = evento.timeStamp
    const ultimo = porCampo.get(chave)
    // Pausa de gente: o que está no campo agora é do professor.
    if (!ultimo || agora - ultimo.em > INTERVALO_MAXIMO_MS) porCampo.set(chave, { em: agora, antes: valor })
    else ultimo.em = agora
    const antes = porCampo.get(chave)!.antes
    if (evento.defaultPrevented && valor !== antes) restaurar(antes)
  }
}
