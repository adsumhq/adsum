/// <reference types="node" />
// Os endereços da mudança no build, para o app e para a ponte. O ensaio
// (`e2e/mudanca.spec.ts`) troca os dois por origens locais com
// `ADSUM_MUDANCA`, um JSON no formato de `Mudanca`; publicado, valem os de
// `endereco.ts`.

import { MUDANCA, type Mudanca } from '../nucleo/endereco.ts'

export function mudancaDoBuild(): Mudanca {
  const doAmbiente = process.env.ADSUM_MUDANCA
  return doAmbiente ? (JSON.parse(doAmbiente) as Mudanca) : MUDANCA
}
