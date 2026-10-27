// `#/chegada`: a janela que a ponte do endereço antigo abre para entregar a
// base (`docs/14_casa_nova.md`). Fora do `Fluxo` e do `ProvedorAdsum`, como a
// janela do SIGAA: não liga leitor nem mexe na chamada.

import { useEffect, useState } from 'react'
import { receberMudanca } from '../ambiente/mudanca.ts'
import { descreverResumo, lerMensagem, type Desfecho, type ResumoDaBase } from '../nucleo/mudanca.ts'
import type { Repositorio } from '../portas/Repositorio.ts'
import { abrirBaseDaChegada } from './adsum.ts'

/** Sem o cofre nesse prazo, a página antiga não está mais lá para entregar. */
const ESPERA_MS = 30_000

/** O app aberto noutra janela relê a base quando a mudança chega. Ver `App.tsx`. */
export const CANAL_DA_MUDANCA = 'adsum-mudanca'

type Estado =
  | { tipo: 'sem_ponte' }
  | { tipo: 'esperando' }
  | { tipo: 'recebido'; desfecho: Desfecho; resumo: ResumoDaBase; problemas: string[] }

export function Chegada({
  abrirRepositorio = abrirBaseDaChegada,
  ponte = window.opener as Window | null,
  origemDaPonte = __MUDANCA__.de.origem,
  abrirApp = () => {
    window.location.hash = ''
    window.location.reload()
  },
}: {
  abrirRepositorio?: () => Promise<Repositorio>
  ponte?: Pick<Window, 'postMessage'> | null
  origemDaPonte?: string
  abrirApp?: () => void
}) {
  const [estado, setEstado] = useState<Estado>(() => (ponte ? { tipo: 'esperando' } : { tipo: 'sem_ponte' }))

  useEffect(() => {
    if (!ponte) return
    let recebeu = false
    const ouvir = async (evento: MessageEvent) => {
      const mensagem = lerMensagem(evento, origemDaPonte)
      if (mensagem?.tipo !== 'cofre' || recebeu) return
      recebeu = true
      const repositorio = await abrirRepositorio()
      const resultado = await receberMudanca(repositorio, mensagem.arquivos)
      ponte.postMessage({ adsum: 'mudanca', tipo: 'recebido', ...resultado }, origemDaPonte)
      if (resultado.desfecho === 'trazido' && typeof BroadcastChannel === 'function') {
        const canal = new BroadcastChannel(CANAL_DA_MUDANCA)
        canal.postMessage('chegou')
        canal.close()
      }
      setEstado({ tipo: 'recebido', ...resultado })
    }
    const ouvinte = (e: MessageEvent) => void ouvir(e)
    window.addEventListener('message', ouvinte)
    ponte.postMessage({ adsum: 'mudanca', tipo: 'pronta' }, origemDaPonte)
    const prazo = setTimeout(() => {
      if (!recebeu) setEstado({ tipo: 'sem_ponte' })
    }, ESPERA_MS)
    return () => {
      window.removeEventListener('message', ouvinte)
      clearTimeout(prazo)
    }
  }, [ponte, origemDaPonte, abrirRepositorio])

  const botao = (
    <button className="botao--acento pasta__botao" onClick={abrirApp}>
      Abrir o Adsum
    </button>
  )

  if (estado.tipo === 'esperando') {
    return (
      <section className="repouso" aria-busy="true">
        <p className="repouso__turma">Mudança de endereço</p>
        <p className="repouso__acao">Recebendo seus dados</p>
      </section>
    )
  }

  if (estado.tipo === 'sem_ponte') {
    return (
      <section className="repouso">
        <p className="repouso__turma">Mudança de endereço</p>
        <p className="repouso__acao">Abra pelo endereço antigo</p>
        <p className="pasta__nota">
          Esta página recebe os dados do endereço antigo do Adsum. Abra o endereço antigo e toque em Levar meus
          dados.
        </p>
        {botao}
      </section>
    )
  }

  const { desfecho, resumo, problemas } = estado
  return (
    <section className="repouso">
      <p className="repouso__turma">Mudança de endereço</p>
      <p className="repouso__acao">{TITULOS[desfecho]}</p>
      {desfecho === 'trazido' && <p className="pasta__nota">{descreverResumo(resumo)}</p>}
      {desfecho === 'ja_tinha' && (
        <p className="pasta__nota">
          Nada foi trocado. Se você já escolheu a sua pasta aqui, os dados vieram dela.
        </p>
      )}
      {desfecho === 'falhou' && (
        <p className="pasta__nota">Nada foi apagado no endereço antigo. Feche esta janela e tente de novo.</p>
      )}
      {desfecho === 'trazido' && (
        <p className="pasta__nota">
          No Chrome ou no Edge, quando o Adsum pedir a pasta, escolha a mesma de antes.
        </p>
      )}
      {problemas.length > 0 && (
        <ul className="pasta__nota">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {botao}
    </section>
  )
}

const TITULOS: Record<Desfecho, string> = {
  trazido: 'Seus dados chegaram',
  ja_tinha: 'Este endereço já tem seus dados',
  falhou: 'Os dados não chegaram',
}
