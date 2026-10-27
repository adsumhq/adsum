// Para onde o favorito abre a janela: o site publicado, na rota `#/sigaa`. O
// favorito leva isto gravado e nunca se atualiza na barra de quem o arrastou.

import { ORIGEM, SITE } from '../nucleo/endereco.ts'
import type { Destino } from './ligacao.ts'

export const DESTINO: Destino = { origem: ORIGEM, url: `${SITE}#/sigaa` }
