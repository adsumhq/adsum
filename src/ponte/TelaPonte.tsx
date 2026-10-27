// A ponte: o que fica no endereço antigo depois da mudança (`docs/14`).
//
// Ela não é um segundo Adsum. Só lê a base deste navegador e a entrega ao
// endereço novo; não liga leitor, não abre chamada e não toca na pasta. E
// **só copia**: a base daqui fica como estava, que é o que deixa voltar atrás.

import { useEffect, useRef, useState } from 'react'
import { arquivosDoCofre, resumoDaBase } from '../ambiente/mudanca.ts'
import { ehWebKit, instalado } from '../ambiente/instalacao.ts'
import { urlDaCasa, type Mudanca } from '../nucleo/endereco.ts'
import { NOME_DO_BACKUP, baseVazia, descreverResumo, lerMensagem, paraJsonBackup, type Desfecho, type ResumoDaBase } from '../nucleo/mudanca.ts'
import type { Repositorio } from '../portas/Repositorio.ts'

/** Sem resposta do endereço novo nesse prazo, alguma coisa ficou no caminho. */
const ESPERA_MS = 30_000

type Levando =
  | { tipo: 'parado' }
  | { tipo: 'abrindo' }
  | { tipo: 'bloqueado' }
  | { tipo: 'sem_resposta' }
  | { tipo: 'recebido'; desfecho: Desfecho; resumo: ResumoDaBase; problemas: string[] }

export function TelaPonte({
  mudanca = __MUDANCA__,
  abrirRepositorio,
  abrirJanela = (url) => window.open(url, '_blank'),
  hash = window.location.hash,
  soPeloBackup = ehWebKit() && instalado(),
  irPara = (url) => window.location.assign(url),
}: {
  mudanca?: Mudanca
  abrirRepositorio: () => Promise<Repositorio>
  abrirJanela?: (url: string) => Pick<Window, 'postMessage'> | null
  hash?: string
  /**
   * O app instalado no Safari tem armazenamento próprio, separado do
   * navegador: a janela que ele abre cai no Safari, e os dados chegariam lá,
   * não no app novo instalado. Aí o caminho é o arquivo.
   */
  soPeloBackup?: boolean
  irPara?: (url: string) => void
}) {
  const novo = urlDaCasa(mudanca.para)
  const nomeDoNovo = new URL(mudanca.para.origem).host
  const [repositorio, setRepositorio] = useState<Repositorio>()
  const [resumo, setResumo] = useState<ResumoDaBase>()
  const [levando, setLevando] = useState<Levando>({ tipo: 'parado' })
  const parar = useRef<() => void>(undefined)

  useEffect(() => {
    void abrirRepositorio().then(async (r) => {
      setRepositorio(r)
      setResumo(await resumoDaBase(r))
    })
  }, [abrirRepositorio])

  useEffect(() => () => parar.current?.(), [])

  const levar = () => {
    if (!repositorio) return
    parar.current?.()
    const janela = abrirJanela(`${novo}#/chegada`)
    if (!janela) return setLevando({ tipo: 'bloqueado' })
    setLevando({ tipo: 'abrindo' })

    let entregue = false
    const ouvir = async (evento: MessageEvent) => {
      const mensagem = lerMensagem(evento, mudanca.para.origem)
      if (mensagem?.tipo === 'pronta' && !entregue) {
        entregue = true
        janela.postMessage({ adsum: 'mudanca', tipo: 'cofre', arquivos: await arquivosDoCofre(repositorio) }, mudanca.para.origem)
      }
      if (mensagem?.tipo === 'recebido') {
        parar.current?.()
        setLevando({ tipo: 'recebido', desfecho: mensagem.desfecho, resumo: mensagem.resumo, problemas: mensagem.problemas })
      }
    }
    const ouvinte = (e: MessageEvent) => void ouvir(e)
    window.addEventListener('message', ouvinte)
    const prazo = setTimeout(() => {
      parar.current?.()
      setLevando({ tipo: 'sem_resposta' })
    }, ESPERA_MS)
    parar.current = () => {
      window.removeEventListener('message', ouvinte)
      clearTimeout(prazo)
      parar.current = undefined
    }
  }

  const baixar = async () => {
    if (!repositorio) return
    const url = URL.createObjectURL(new Blob([paraJsonBackup(await arquivosDoCofre(repositorio))], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = NOME_DO_BACKUP
    link.click()
    // Revogar cedo demais cancela o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const abrirNovo = (
    <button className="botao--acento pasta__botao" onClick={() => irPara(novo)}>
      Abrir o Adsum
    </button>
  )

  // O favorito do SIGAA arrastado antes da mudança leva o endereço antigo
  // dentro dele, e nunca se atualiza.
  if (hash === '#/sigaa') {
    return (
      <section className="repouso">
        <p className="repouso__turma">Favorito antigo</p>
        <p className="repouso__acao">O Adsum mudou de endereço</p>
        <p className="pasta__nota">
          Este favorito abre o endereço antigo. Abra o Adsum em {nomeDoNovo} e arraste o favorito novo, que está nos
          Ajustes, para a barra de favoritos.
        </p>
        {abrirNovo}
      </section>
    )
  }

  if (!resumo) return <section className="repouso" aria-busy="true" />

  if (levando.tipo === 'recebido') {
    const { desfecho } = levando
    return (
      <section className="repouso">
        <p className="repouso__turma">{nomeDoNovo}</p>
        <p className="repouso__acao">{TITULOS[desfecho]}</p>
        {desfecho === 'trazido' && (
          <p className="pasta__nota">
            {descreverResumo(levando.resumo)} Daqui em diante, use o Adsum em {nomeDoNovo}.
          </p>
        )}
        {desfecho === 'ja_tinha' && (
          <p className="pasta__nota">O endereço novo já tinha dados, e nada foi trocado lá nem aqui.</p>
        )}
        {desfecho === 'falhou' && <p className="pasta__nota">Nada foi apagado aqui. Tente de novo.</p>}
        {levando.problemas.length > 0 && (
          <ul className="pasta__nota">
            {levando.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {desfecho === 'falhou' ? (
          <button className="botao--acento pasta__botao" onClick={levar}>
            Tentar de novo
          </button>
        ) : (
          abrirNovo
        )}
        {desfecho !== 'falhou' && (
          <p className="pasta__nota">
            Se o favorito do SIGAA está na sua barra, troque-o pelo novo, que está nos Ajustes do Adsum.
          </p>
        )}
      </section>
    )
  }

  if (baseVazia(resumo)) {
    return (
      <section className="repouso">
        <p className="repouso__turma">{nomeDoNovo}</p>
        <p className="repouso__acao">O Adsum mudou de endereço</p>
        <p className="pasta__nota">Agora ele mora em {nomeDoNovo}.</p>
        {abrirNovo}
      </section>
    )
  }

  if (soPeloBackup) {
    return (
      <section className="repouso">
        <p className="repouso__turma">{nomeDoNovo}</p>
        <p className="repouso__acao">O Adsum mudou de endereço</p>
        <p className="pasta__nota">
          Este Adsum tem {descreverResumo(resumo).replace(/\.$/, '')}. Eles vão para o endereço novo num arquivo.
        </p>
        <ol className="pasta__nota">
          <li>Baixe o backup.</li>
          <li>Abra {nomeDoNovo} no Safari e instale o Adsum de novo.</li>
          <li>No Adsum novo, toque em Tenho um backup do Adsum e escolha o arquivo.</li>
        </ol>
        <button className="botao--acento pasta__botao" onClick={() => void baixar()}>
          Baixar o backup
        </button>
        <p className="pasta__nota">{CUIDADO}</p>
      </section>
    )
  }

  return (
    <section className="repouso">
      <p className="repouso__turma">{nomeDoNovo}</p>
      <p className="repouso__acao">O Adsum mudou de endereço</p>
      <p className="pasta__nota">
        Este navegador tem {descreverResumo(resumo).replace(/\.$/, '')}. Leve-os para o endereço novo antes de
        continuar. Nada é apagado aqui.
      </p>
      {levando.tipo === 'abrindo' ? (
        <p className="pasta__nota" aria-busy="true">
          Abrindo o endereço novo.
        </p>
      ) : (
        <button className="botao--acento pasta__botao" onClick={levar}>
          Levar meus dados
        </button>
      )}
      {levando.tipo === 'bloqueado' && (
        <p className="pasta__nota">O navegador bloqueou a janela nova. Toque de novo em Levar meus dados.</p>
      )}
      {levando.tipo === 'sem_resposta' && (
        <p className="pasta__nota">O endereço novo não respondeu. Feche a janela que abriu e tente de novo.</p>
      )}
      <button className="botao--quieto" onClick={() => void baixar()}>
        Baixar o backup
      </button>
    </section>
  )
}

const TITULOS: Record<Desfecho, string> = {
  trazido: 'Seus dados estão no endereço novo',
  ja_tinha: 'O endereço novo já tinha seus dados',
  falhou: 'Os dados não chegaram',
}

const CUIDADO =
  'O arquivo tem o cadastro das turmas e o segredo que liga crachás a pessoas. Guarde-o como guardaria a lista de chamada.'
