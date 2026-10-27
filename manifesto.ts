// O manifesto do PWA, o mesmo no app e na ponte (`vite.ponte.config.ts`): o
// app instalado no endereço antigo relê o manifesto de tempos em tempos, e o
// da ponte não pode mudar nome, escopo nem ícone dele.

import type { ManifestOptions } from 'vite-plugin-pwa'

export const MANIFESTO: Partial<ManifestOptions> = {
  name: 'Adsum — frequência por crachá',
  short_name: 'Adsum',
  description:
    'Registro de frequência em sala por leitura de crachá. Os dados ficam no seu computador.',
  lang: 'pt-BR',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  // O fundo do app é branco no claro e preto no escuro; o splash não sabe
  // qual será, e branco é o que combina com a maioria das telas.
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'icone-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
