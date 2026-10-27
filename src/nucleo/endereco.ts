// Onde o Adsum mora: o único lugar com o endereço do site e do repositório.
//
// A origem prende a base, o handle da pasta, o service worker e o favorito do
// SIGAA, que leva o endereço gravado dentro dele. Mudar de casa é mudar aqui,
// numa janela combinada (`docs/14_casa_nova.md`), e o `endereco.test.ts` acusa
// endereço escrito à mão em qualquer outro arquivo do app.

export const ORIGEM = 'https://willianrupert.github.io'

/** O caminho do app na origem, com as duas barras. É o `base` do Vite. */
export const CAMINHO = '/adsum/'

export const SITE = `${ORIGEM}${CAMINHO}`

const REPOSITORIO = 'willianrupert/adsum'

export const REPOSITORIO_URL = `https://github.com/${REPOSITORIO}`

/**
 * O guia que o botão "Guia" dos Ajustes baixa na hora: o único gesto do Adsum
 * que usa a rede. O arquivo cru, e não a página do GitHub, porque quem baixa é
 * `fetch`, e o `raw.githubusercontent.com` libera o pedido de qualquer origem.
 */
export const GUIA_URL = `https://raw.githubusercontent.com/${REPOSITORIO}/main/docs/Adsum-guia.pdf`
