// O favorito do SIGAA chega ao professor por aqui (`docs/08`, `docs/11` passo
// 26): um botão que se arrasta para a barra de favoritos. O código vem do
// build (`virtual:favorito`), nunca é colado à mão.

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { FAVORITO } from 'virtual:favorito'

/** Onde o fantasma começa (o botão) e onde pousa (a vaga na barra), medidos no palco. */
interface Trajeto {
  x0: number
  y0: number
  w0: number
  h0: number
  f0: string
  x1: number
  y1: number
  w1: number
  h1: number
}

function medir(palco: HTMLElement, botao: HTMLElement, vaga: HTMLElement): Trajeto {
  const p = palco.getBoundingClientRect()
  const b = botao.getBoundingClientRect()
  const v = vaga.getBoundingClientRect()
  return {
    x0: b.left - p.left,
    y0: b.top - p.top,
    w0: b.width,
    h0: b.height,
    f0: getComputedStyle(botao).fontSize,
    x1: v.left - p.left,
    y1: v.top - p.top,
    w1: v.width,
    h1: v.height,
  }
}

export function CartaoDoFavorito() {
  const [recado, setRecado] = useState<string>()
  const palco = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLAnchorElement>(null)
  const vaga = useRef<HTMLSpanElement>(null)
  const [trajeto, setTrajeto] = useState<Trajeto>()

  // O gesto desenhado sai do botão de verdade e pousa na vaga com o tamanho
  // dela: medido, e não chutado, para a ida ser contínua em qualquer fonte.
  useLayoutEffect(() => {
    const refazer = () => {
      if (palco.current && botao.current && vaga.current) setTrajeto(medir(palco.current, botao.current, vaga.current))
    }
    refazer()
    if (typeof ResizeObserver === 'undefined' || !palco.current) return
    const observador = new ResizeObserver(refazer)
    observador.observe(palco.current)
    return () => observador.disconnect()
  }, [])

  const estilo =
    trajeto &&
    ({
      '--x0': `${trajeto.x0}px`,
      '--y0': `${trajeto.y0}px`,
      '--w0': `${trajeto.w0}px`,
      '--h0': `${trajeto.h0}px`,
      '--f0': trajeto.f0,
      '--x1': `${trajeto.x1}px`,
      '--y1': `${trajeto.y1}px`,
      '--w1': `${trajeto.w1}px`,
      '--h1': `${trajeto.h1}px`,
    } as CSSProperties)

  return (
    <div className="favorito">
      <p className="favorito__texto">Arraste o botão para a barra de favoritos. Na planilha de frequência do SIGAA, clique nele.</p>
      <div className="favorito__palco" ref={palco}>
        <div className="favorito__barra" aria-hidden="true">
          <span />
          <span />
          <span className="favorito__destino" ref={vaga} />
        </div>
        <a
          className="favorito__botao"
          ref={(a) => {
            botao.current = a
            // O React recusa `javascript:` no `href`; o favorito entra direto no DOM.
            a?.setAttribute('href', FAVORITO)
          }}
          draggable="true"
          onClick={(e) => {
            e.preventDefault()
            setRecado('É para arrastar, não clicar. Leve o botão até a barra de favoritos.')
          }}
        >
          Adsum
        </a>
        {/* Por cima do botão e sem receber o ponteiro: quem se arrasta é o botão. */}
        <span className={trajeto ? 'favorito__fantasma favorito__fantasma--medido' : 'favorito__fantasma'} style={estilo} aria-hidden="true">
          Adsum
        </span>
      </div>
      <p className="favorito__nota" role="status">
        {recado ?? 'Sem a barra de favoritos à vista? No Chrome, ⇧⌘B no Mac, Ctrl+Shift+B no Windows.'}
      </p>
    </div>
  )
}
