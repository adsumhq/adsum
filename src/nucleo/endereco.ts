// Onde o Adsum mora: o único lugar com o endereço do site e do repositório.
//
// A origem prende a base, o handle da pasta, o service worker e o favorito do
// SIGAA, que leva o endereço gravado dentro dele. Mudar de casa é mudar aqui,
// numa janela combinada (`docs/14_casa_nova.md`), e o `endereco.test.ts` acusa
// endereço escrito à mão em qualquer outro arquivo do app.

export interface Casa {
  origem: string
  /** O caminho do app na origem, com as duas barras. */
  caminho: string
}

const PESSOAL: Casa = { origem: 'https://willianrupert.github.io', caminho: '/adsum/' }
const CIN: Casa = { origem: 'https://adsum.cin.ufpe.br', caminho: '/' }

/** Onde o app mora hoje. Na janela da migração, vira `CIN`. */
const CASA = PESSOAL

export const ORIGEM = CASA.origem

/** O caminho do app na origem, com as duas barras. É o `base` do Vite. */
export const CAMINHO = CASA.caminho

export const SITE = `${ORIGEM}${CAMINHO}`

/**
 * A mudança: a ponte fica em `de` e entrega a base em `para`. Cada lado só
 * conversa com a origem do outro.
 */
export interface Mudanca {
  de: Casa
  para: Casa
}

export const MUDANCA: Mudanca = { de: PESSOAL, para: CIN }

export const urlDaCasa = (casa: Casa) => `${casa.origem}${casa.caminho}`

const REPOSITORIO = 'willianrupert/adsum'

export const REPOSITORIO_URL = `https://github.com/${REPOSITORIO}`

/**
 * O guia que o botão "Guia" dos Ajustes baixa na hora: o único gesto do Adsum
 * que usa a rede. O arquivo cru, e não a página do GitHub, porque quem baixa é
 * `fetch`, e o `raw.githubusercontent.com` libera o pedido de qualquer origem.
 */
export const GUIA_URL = `https://raw.githubusercontent.com/${REPOSITORIO}/main/docs/Adsum-guia.pdf`
