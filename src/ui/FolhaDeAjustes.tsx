// O conteúdo da folha de Ajustes: a base (`TelaRepositorio`) e, no pé, os
// links que não são uso do dia a dia — Diagnóstico, Guia, GitHub.

import { type ComponentProps, useState } from 'react'
import { semDono } from '../ambiente/diario.ts'
import { baixarGuia } from '../ambiente/guia.ts'
import { REPOSITORIO_URL } from '../nucleo/endereco.ts'
import { TelaRepositorio } from './TelaRepositorio.tsx'

export function FolhaDeAjustes({
  aoAbrirDiagnostico,
  ...base
}: ComponentProps<typeof TelaRepositorio> & { aoAbrirDiagnostico: () => void }) {
  const [recadoGuia, setRecadoGuia] = useState<string>()

  return (
    <>
      <TelaRepositorio {...base} />
      <div className="ajustes__rodape">
        <button className="botao--quieto" onClick={aoAbrirDiagnostico}>
          Diagnóstico
        </button>
        <button
          className="botao--quieto"
          onClick={() => {
            setRecadoGuia(undefined)
            semDono('baixar guia', async () => setRecadoGuia(await baixarGuia()))
          }}
        >
          Guia
        </button>
        <a className="botao--quieto" href={REPOSITORIO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
      {recadoGuia && <p className="ferramentas__nota">{recadoGuia}</p>}
      <p className="ajustes__creditos">© 2026 Adsum</p>
    </>
  )
}
